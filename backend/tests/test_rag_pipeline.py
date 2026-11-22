import pytest
import requests
from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.services.rag import pipeline, vector_store


def test_retrieve_context_filters_by_tenant(monkeypatch):
    client = QdrantClient(":memory:")
    vector_store.ensure_collection(client, "test_rag")
    client.upsert(
        collection_name="test_rag",
        points=[
            models.PointStruct(
                id=index,
                vector=[1.0] + [0.0] * (vector_store.EMBEDDING_DIMENSION - 1),
                payload={
                    "document_id": index,
                    "user_id": owner_id,
                    "chunk_index": 0,
                    "text": f"private context {index}",
                },
            )
            for index, owner_id in ((1, 21), (2, 22))
        ],
    )
    monkeypatch.setattr(vector_store, "qdrant_client", client)
    monkeypatch.setattr(vector_store, "COLLECTION_NAME", "test_rag")
    monkeypatch.setattr(
        vector_store,
        "embed_text",
        lambda query: [1.0] + [0.0] * (vector_store.EMBEDDING_DIMENSION - 1),
    )

    matches = pipeline.retrieve_context("question", user_id=21)

    assert len(matches) == 1
    assert matches[0]["user_id"] == 21
    assert matches[0]["text"] == "private context 1"
    assert pipeline.retrieve_context("question", user_id=23) == []


def test_no_context_returns_safe_answer_without_calling_ollama(monkeypatch):
    def unexpected_call(*args, **kwargs):
        raise AssertionError("Ollama should not be called without context.")

    monkeypatch.setattr(pipeline.requests, "post", unexpected_call)

    assert pipeline.generate_rag_answer("question", []) == pipeline.NO_CONTEXT_ANSWER


def test_generate_rag_answer_sends_context_and_question(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"response": "  Supported answer.  "}

    captured = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse()

    monkeypatch.setattr(pipeline.requests, "post", fake_post)
    answer = pipeline.generate_rag_answer(
        "What is in the file?",
        [
            {
                "document_id": 8,
                "chunk_index": 2,
                "text": "The document says hello.",
            }
        ],
    )

    assert answer == "Supported answer."
    assert captured["url"] == pipeline.OLLAMA_GENERATE_URL
    assert captured["json"]["model"] == "qwen2.5:3b"
    assert "The document says hello." in captured["json"]["prompt"]
    assert "What is in the file?" in captured["json"]["prompt"]
    assert captured["json"]["stream"] is False


def test_generate_rag_answer_reports_ollama_connection_failure(monkeypatch):
    def offline(*args, **kwargs):
        raise requests.ConnectionError("Ollama is offline.")

    monkeypatch.setattr(pipeline.requests, "post", offline)
    with pytest.raises(pipeline.GenerationError):
        pipeline.generate_rag_answer(
            "question",
            [{"document_id": 1, "chunk_index": 0, "text": "context"}],
        )


def test_query_route_only_cites_documents_owned_by_current_user(monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.api.routes import rag as rag_routes
    from app.db.session import Base
    from app.models.document import Document
    from app.models.user import User
    from app.schemas.rag import RAGQueryRequest

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(email="owner@example.com", hashed_password="hash")
        other_user = User(email="other@example.com", hashed_password="hash")
        db.add_all([owner, other_user])
        db.commit()
        db.refresh(owner)
        db.refresh(other_user)
        owned_document = Document(
            user_id=owner.id,
            filename="owned.txt",
            file_path="data/documents/owned.txt",
            file_size=5,
            file_type="txt",
            processing_status="completed",
        )
        other_document = Document(
            user_id=other_user.id,
            filename="private.txt",
            file_path="data/documents/private.txt",
            file_size=7,
            file_type="txt",
            processing_status="completed",
        )
        db.add_all([owned_document, other_document])
        db.commit()
        db.refresh(owned_document)
        db.refresh(other_document)

        retrieved = [
            {
                "document_id": owned_document.id,
                "user_id": owner.id,
                "chunk_index": 0,
                "text": "visible source",
                "score": 0.873,
                "page_number": 2,
            },
            {
                "document_id": other_document.id,
                "user_id": owner.id,
                "chunk_index": 0,
                "text": "must not be cited",
            },
        ]
        generation_context = []
        monkeypatch.setattr(rag_routes, "retrieve_context", lambda *args, **kwargs: retrieved)

        def fake_generate(query, context):
            generation_context.extend(context)
            return "Answer."

        monkeypatch.setattr(rag_routes, "generate_rag_answer", fake_generate)

        response = rag_routes.query_documents(
            RAGQueryRequest(question="Question?"),
            db=db,
            current_user=owner,
        )

    assert response.answer == "Answer."
    assert len(response.sources) == 1
    assert response.sources[0].document_id == owned_document.id
    assert response.sources[0].filename == "owned.txt"
    assert response.sources[0].chunk_indices == [0]
    assert response.sources[0].chunks[0].text == "visible source"
    assert response.sources[0].chunks[0].score == 0.873
    assert response.sources[0].chunks[0].page_number == 2
    assert [chunk["text"] for chunk in generation_context] == ["visible source"]
