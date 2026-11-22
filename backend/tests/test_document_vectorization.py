import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.routes import documents as document_routes
from app.db.session import Base
from app.models.document import Document
from app.models.user import User
from app.services.rag.vector_store import VectorStoreError


@pytest.fixture
def db_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_vectorization_failure_is_logged_and_status_persisted(
    db_session,
    monkeypatch,
    caplog,
):
    user = User(email="owner@example.com", hashed_password="hash")
    db_session.add(user)
    db_session.commit()
    document = Document(
        user_id=user.id,
        filename="notes.txt",
        file_path="data/documents/notes.txt",
        file_size=5,
        file_type="txt",
        processing_status="processing",
    )
    db_session.add(document)
    db_session.commit()

    def fail_vectorization(**kwargs):
        raise VectorStoreError("Qdrant is unavailable.")

    monkeypatch.setattr(document_routes, "process_document_text", fail_vectorization)

    with pytest.raises(HTTPException) as error:
        document_routes._process_document(db_session, document, "hello")

    assert error.value.status_code == 503
    assert "Check the backend logs" in error.value.detail
    db_session.refresh(document)
    assert document.processing_status == "failed"
    assert "Vectorization failed for document" in caplog.text
    assert "Qdrant is unavailable." in caplog.text


def test_document_is_ready_only_after_vectors_are_written(
    db_session,
    monkeypatch,
):
    user = User(email="owner@example.com", hashed_password="hash")
    db_session.add(user)
    db_session.commit()
    document = Document(
        user_id=user.id,
        filename="notes.txt",
        file_path="data/documents/notes.txt",
        file_size=5,
        file_type="txt",
        processing_status="processing",
    )
    db_session.add(document)
    db_session.commit()
    monkeypatch.setattr(
        document_routes,
        "process_document_text",
        lambda **kwargs: 1,
    )

    result = document_routes._process_document(db_session, document, "hello")

    assert result.processing_status == "completed"
