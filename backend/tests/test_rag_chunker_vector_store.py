import numpy as np
import pytest
from qdrant_client import QdrantClient

from app.core.config import settings
from app.services.rag import pipeline, vector_store
from app.services.rag.chunker import chunk_text


def test_chunk_text_bounds_size_and_overlaps():
    text = " ".join(f"word{index}" for index in range(160))

    chunks = chunk_text(text, chunk_size=100, chunk_overlap=20)

    assert len(chunks) > 1
    assert all(0 < len(chunk) <= 100 for chunk in chunks)
    assert all(left.split()[-1] in right for left, right in zip(chunks, chunks[1:]))


@pytest.mark.parametrize(
    ("chunk_size", "chunk_overlap"),
    [(0, 0), (10, 10), (10, -1)],
)
def test_chunk_text_rejects_invalid_sizes(chunk_size, chunk_overlap):
    with pytest.raises(ValueError):
        chunk_text("some text", chunk_size, chunk_overlap)


def test_process_document_text_upserts_and_removes_stale_chunks(monkeypatch):
    client = QdrantClient(":memory:")

    class FakeEmbeddingModel:
        def encode(self, chunks, **kwargs):
            return np.ones((len(chunks), vector_store.EMBEDDING_DIMENSION))

    monkeypatch.setattr(vector_store, "_get_embedding_model", FakeEmbeddingModel)
    text = " ".join(f"word{index}" for index in range(200))

    chunk_count = vector_store.process_document_text(
        text,
        document_id=12,
        user_id=34,
        client=client,
        collection_name="test_documents",
    )
    points, _ = client.scroll(
        collection_name="test_documents",
        with_payload=True,
        with_vectors=False,
    )
    assert chunk_count == len(points)
    assert len(points) > 1
    assert all(
        point.payload["document_id"] == 12
        and point.payload["user_id"] == 34
        and point.payload["text"]
        for point in points
    )

    vector_store.process_document_text(
        "short text",
        document_id=12,
        user_id=34,
        client=client,
        collection_name="test_documents",
    )
    points, _ = client.scroll(
        collection_name="test_documents",
        with_payload=True,
        with_vectors=False,
    )
    assert len(points) == 1
    assert points[0].payload["text"] == "short text"


def test_local_qdrant_path_persists_vectors_and_filters_tenants(
    monkeypatch,
    tmp_path,
):
    storage_path = tmp_path / "qdrant_data"
    monkeypatch.setattr(settings, "QDRANT_PATH", str(storage_path))
    monkeypatch.setattr(settings, "QDRANT_URL", "http://127.0.0.1:6333")

    class FakeEmbeddingModel:
        def encode(self, chunks, **kwargs):
            return np.ones((len(chunks), vector_store.EMBEDDING_DIMENSION))

    monkeypatch.setattr(vector_store, "_get_embedding_model", FakeEmbeddingModel)
    monkeypatch.setattr(
        vector_store,
        "embed_text",
        lambda query: [1.0] * vector_store.EMBEDDING_DIMENSION,
    )
    collection_name = "persistent_test"
    client = vector_store.create_qdrant_client()
    reopened_client = None
    try:
        vector_store.process_document_text(
            "Records are retained for seven years.",
            document_id=41,
            user_id=12,
            client=client,
            collection_name=collection_name,
        )
        client.close()

        reopened_client = vector_store.create_qdrant_client()
        monkeypatch.setattr(vector_store, "qdrant_client", reopened_client)
        monkeypatch.setattr(vector_store, "COLLECTION_NAME", collection_name)

        matches = pipeline.retrieve_context("How long are records retained?", 12)

        assert len(matches) == 1
        assert matches[0]["document_id"] == 41
        assert matches[0]["text"] == "Records are retained for seven years."
        assert pipeline.retrieve_context("How long are records retained?", 99) == []
    finally:
        if reopened_client is not None:
            reopened_client.close()


def test_unreachable_qdrant_url_falls_back_to_local_path(monkeypatch, tmp_path):
    calls = []

    class UnavailableRemoteClient:
        def get_collections(self):
            raise ConnectionError("Qdrant is offline.")

        def close(self):
            calls.append(("closed", None))

    def fake_client(**kwargs):
        calls.append(("client", kwargs))
        if "url" in kwargs:
            return UnavailableRemoteClient()
        return kwargs

    fallback_path = tmp_path / "fallback"
    monkeypatch.setattr(vector_store, "QdrantClient", fake_client)
    monkeypatch.setattr(vector_store, "DEFAULT_QDRANT_PATH", fallback_path)
    monkeypatch.setattr(settings, "QDRANT_PATH", None)
    monkeypatch.setattr(settings, "QDRANT_URL", "http://127.0.0.1:6333")

    result = vector_store.create_qdrant_client()

    assert result == {"path": str(fallback_path)}
    assert calls == [
        ("client", {"url": "http://127.0.0.1:6333", "timeout": 1}),
        ("closed", None),
        ("client", {"path": str(fallback_path)}),
    ]


def test_missing_qdrant_url_uses_default_local_path(monkeypatch, tmp_path):
    fallback_path = tmp_path / "fallback"
    calls = []

    def fake_client(**kwargs):
        calls.append(kwargs)
        return kwargs

    monkeypatch.setattr(vector_store, "QdrantClient", fake_client)
    monkeypatch.setattr(vector_store, "DEFAULT_QDRANT_PATH", fallback_path)
    monkeypatch.setattr(settings, "QDRANT_PATH", None)
    monkeypatch.setattr(settings, "QDRANT_URL", None)

    result = vector_store.create_qdrant_client()

    assert result == {"path": str(fallback_path)}
    assert calls == [{"path": str(fallback_path)}]
