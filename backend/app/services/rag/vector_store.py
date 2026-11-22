import logging
from functools import lru_cache
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.core.config import settings
from app.services.rag.chunker import chunk_text


logger = logging.getLogger(__name__)
COLLECTION_NAME = "document_vectors"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384
DEFAULT_QDRANT_PATH = Path(__file__).resolve().parents[3] / "qdrant_data"


def _local_storage_path() -> str:
    configured_path = settings.QDRANT_PATH
    path = Path(configured_path).expanduser() if configured_path else DEFAULT_QDRANT_PATH
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[3] / path
    return str(path.resolve())


def create_qdrant_client() -> QdrantClient:
    if settings.QDRANT_PATH or not settings.QDRANT_URL:
        path = _local_storage_path()
        logger.info("Using persistent local Qdrant storage at %s.", path)
        return QdrantClient(path=path)

    client = None
    try:
        client = QdrantClient(url=settings.QDRANT_URL, timeout=1)
        client.get_collections()
        return client
    except Exception:
        if client is not None:
            try:
                client.close()
            except Exception:
                logger.exception("Could not close the unavailable Qdrant HTTP client.")
        path = _local_storage_path()
        logger.warning(
            "Qdrant endpoint %s is unavailable; using persistent local storage at %s.",
            settings.QDRANT_URL,
            path,
            exc_info=True,
        )
        return QdrantClient(path=path)


qdrant_client = create_qdrant_client()


class VectorStoreError(RuntimeError):
    """Raised when embedding or vector storage fails."""


@lru_cache(maxsize=1)
def _get_embedding_model():
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(EMBEDDING_MODEL_NAME)
    except Exception as exc:
        logger.exception("Could not load embedding model %s.", EMBEDDING_MODEL_NAME)
        raise VectorStoreError("The local embedding model could not be loaded.") from exc


def embed_text(text: str) -> list[float]:
    try:
        vectors = _get_embedding_model().encode(
            [text],
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        vector = vectors[0].tolist()
        if len(vector) != EMBEDDING_DIMENSION:
            raise VectorStoreError("The embedding model returned a vector of an invalid size.")
        return [float(value) for value in vector]
    except VectorStoreError:
        raise
    except Exception as exc:
        logger.exception("Could not generate an embedding for the search query.")
        raise VectorStoreError("Could not generate the query embedding.") from exc


def ensure_collection(
    client: QdrantClient | None = None,
    collection_name: str = COLLECTION_NAME,
) -> None:
    if client is None:
        client = qdrant_client

    try:
        if not client.collection_exists(collection_name=collection_name):
            client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=EMBEDDING_DIMENSION,
                    distance=models.Distance.COSINE,
                ),
            )
    except Exception as exc:
        try:
            if client.collection_exists(collection_name=collection_name):
                logger.info(
                    "Qdrant collection %s was created concurrently.",
                    collection_name,
                )
                return
        except Exception:
            logger.exception(
                "Could not verify Qdrant collection %s after initialization failed.",
                collection_name,
            )
        logger.exception("Could not ensure Qdrant collection %s exists.", collection_name)
        raise VectorStoreError(
            f"Qdrant is unavailable or collection '{collection_name}' could not be initialized."
        ) from exc


def process_document_text(
    text: str,
    document_id: int,
    user_id: int,
    client: QdrantClient | None = None,
    collection_name: str = COLLECTION_NAME,
) -> int:
    if client is None:
        client = qdrant_client

    chunks = chunk_text(text)
    if not chunks:
        raise VectorStoreError("The document contains no extractable text to index.")

    try:
        ensure_collection(client=client, collection_name=collection_name)
        vectors = _get_embedding_model().encode(
            chunks,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        vectors = vectors.tolist()
        if len(vectors) != len(chunks) or any(
            len(vector) != EMBEDDING_DIMENSION for vector in vectors
        ):
            raise VectorStoreError("The embedding model returned vectors of an invalid size.")

        points = [
            models.PointStruct(
                id=str(uuid5(NAMESPACE_URL, f"enterpriseiq:{document_id}:{index}")),
                vector=[float(value) for value in vector],
                payload={
                    "document_id": document_id,
                    "user_id": user_id,
                    "chunk_index": index,
                    "text": chunk,
                },
            )
            for index, (chunk, vector) in enumerate(zip(chunks, vectors))
        ]
        client.upsert(
            collection_name=collection_name,
            points=points,
            wait=True,
        )
        _delete_document_points(
            client,
            document_id,
            collection_name,
            minimum_chunk_index=len(chunks),
        )
    except VectorStoreError:
        raise
    except Exception as exc:
        logger.exception(
            "Could not vectorize document %s for user %s.",
            document_id,
            user_id,
        )
        raise VectorStoreError("Could not generate or store document vectors.") from exc

    return len(chunks)


def _delete_document_points(
    client: QdrantClient,
    document_id: int,
    collection_name: str,
    minimum_chunk_index: int | None = None,
) -> None:
    conditions = [
        models.FieldCondition(
            key="document_id",
            match=models.MatchValue(value=document_id),
        )
    ]
    if minimum_chunk_index is not None:
        conditions.append(
            models.FieldCondition(
                key="chunk_index",
                range=models.Range(gte=minimum_chunk_index),
            )
        )
    try:
        client.delete(
            collection_name=collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(must=conditions)
            ),
            wait=True,
        )
    except Exception as exc:
        logger.exception(
            "Could not remove stale vector points for document %s.",
            document_id,
        )
        raise VectorStoreError("Could not remove stale document vectors.") from exc
