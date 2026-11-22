from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.db.session import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.rag import (
    RAGQueryRequest,
    RAGQueryResponse,
    SourceCitation,
    SourceChunkCitation,
)
from app.services.rag.pipeline import (
    GenerationError,
    RetrievalError,
    generate_rag_answer,
    retrieve_context,
)


router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post("/query", response_model=RAGQueryResponse)
def query_documents(
    request: RAGQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RAGQueryResponse:
    try:
        context = retrieve_context(request.question, user_id=current_user.id)
    except RetrievalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document search is currently unavailable.",
        ) from exc

    document_ids = {chunk["document_id"] for chunk in context}
    documents = (
        db.query(Document)
        .filter(
            Document.user_id == current_user.id,
            Document.id.in_(document_ids),
        )
        .all()
        if document_ids
        else []
    )
    filenames = {document.id: document.filename for document in documents}
    context = [
        chunk for chunk in context if chunk["document_id"] in filenames
    ]

    cited_chunks: dict[int, dict[int, dict[str, Any]]] = defaultdict(dict)
    for chunk in context:
        cited_chunks[chunk["document_id"]][chunk["chunk_index"]] = chunk
    sources = [
        SourceCitation(
            document_id=document_id,
            filename=filenames[document_id],
            chunk_indices=sorted(chunks),
            chunks=[
                SourceChunkCitation(
                    chunk_index=chunk_index,
                    text=chunks[chunk_index]["text"],
                    score=chunks[chunk_index].get("score"),
                    page_number=chunks[chunk_index].get("page_number"),
                )
                for chunk_index in sorted(chunks)
            ],
        )
        for document_id, chunks in sorted(cited_chunks.items())
    ]

    try:
        answer = generate_rag_answer(request.question, context)
    except GenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Answer generation is currently unavailable.",
        ) from exc

    return RAGQueryResponse(answer=answer, sources=sources)
