import logging
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.db.session import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.services.ingestion.parser import (
    DocumentParsingError,
    SUPPORTED_EXTENSIONS,
    extract_text,
)
from app.services.rag.vector_store import VectorStoreError, process_document_text


logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parents[4]
DOCUMENT_STORAGE_DIR = PROJECT_ROOT / "data" / "documents"

router = APIRouter(prefix="/documents", tags=["Documents"])


def _process_document(db: Session, document: Document, text: str) -> Document:
    document.processing_status = "processing"
    db.commit()

    try:
        chunk_count = process_document_text(
            text=text,
            document_id=document.id,
            user_id=document.user_id,
        )
        if chunk_count == 0:
            raise VectorStoreError("The document produced no searchable chunks.")
    except Exception as exc:
        logger.exception(
            "Vectorization failed for document %s (user %s).",
            document.id,
            document.user_id,
        )
        document.processing_status = "failed"
        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            logger.exception(
                "Could not persist failed status for document %s.",
                document.id,
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document vectorization failed. Check the backend logs for details.",
        ) from exc

    document.processing_status = "completed"
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception(
            "Vectors were written but ready status could not be persisted for document %s.",
            document.id,
        )
        raise
    db.refresh(document)
    return document


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Document:
    original_filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    extension = Path(original_filename).suffix.lower()
    if not original_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A filename is required.",
        )
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Supported file types are PDF, DOCX, TXT, MD, and CSV.",
        )

    try:
        DOCUMENT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document storage directory is unavailable.",
        ) from exc

    stored_path = DOCUMENT_STORAGE_DIR / f"{uuid4().hex}{extension}"
    keep_file = False
    file_created = False
    try:
        file_size = 0
        try:
            with stored_path.open("xb") as destination:
                file_created = True
                while True:
                    chunk = file.file.read(1024 * 1024)
                    if not chunk:
                        break
                    destination.write(chunk)
                    file_size += len(chunk)
        except OSError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="The uploaded document could not be stored.",
            ) from exc

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is empty.",
            )

        try:
            text = extract_text(stored_path)
        except DocumentParsingError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

        document = Document(
            user_id=current_user.id,
            filename=original_filename,
            file_path=str(stored_path.relative_to(PROJECT_ROOT)),
            file_size=file_size,
            file_type=extension.removeprefix("."),
            processing_status="processing",
        )
        db.add(document)
        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise

        keep_file = True
        return _process_document(db, document, text)
    finally:
        if file_created and not keep_file:
            try:
                stored_path.unlink(missing_ok=True)
            except OSError:
                logger.exception("Failed to remove an upload after processing failed.")


@router.post(
    "/{document_id}/process",
    response_model=DocumentResponse,
)
def process_existing_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Document:
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.user_id == current_user.id,
        )
        .first()
    )
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    file_path = (PROJECT_ROOT / document.file_path).resolve()
    try:
        file_path.relative_to(PROJECT_ROOT.resolve())
        text = extract_text(file_path)
    except (ValueError, DocumentParsingError) as exc:
        logger.exception("Could not parse stored document %s.", document_id)
        document.processing_status = "failed"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The stored document could not be parsed.",
        ) from exc

    return _process_document(db, document, text)


@router.get("/", response_model=list[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[Document]:
    return (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
