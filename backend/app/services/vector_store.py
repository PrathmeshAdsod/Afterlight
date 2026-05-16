"""
ChromaDB vector store for memory card retrieval (RAG).
Each memory space has its own collection.
Embeddings via sentence-transformers (all-MiniLM-L6-v2) — runs locally, no API.
Falls back gracefully if chromadb/sentence-transformers are not installed.
"""
import os
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

os.makedirs(settings.chroma_dir, exist_ok=True)

_chroma_client = None
_embedding_model = None

# Lazy import guards
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    logger.warning("chromadb not installed. Vector search disabled. Install with: pip install chromadb")

try:
    from sentence_transformers import SentenceTransformer
    ST_AVAILABLE = True
except ImportError:
    ST_AVAILABLE = False
    logger.warning("sentence-transformers not installed. Embeddings disabled.")


def get_chroma_client():
    global _chroma_client
    if not CHROMADB_AVAILABLE:
        return None
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_embedding_model():
    global _embedding_model
    if not ST_AVAILABLE:
        return None
    if _embedding_model is None:
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        _embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _embedding_model


def _collection_name(space_id: str) -> str:
    return f"space_{space_id.replace('-', '_')}"


def embed_text(text: str) -> list[float] | None:
    model = get_embedding_model()
    if model is None:
        return None
    return model.encode(text, normalize_embeddings=True).tolist()


def upsert_memory_card(space_id: str, card_id: str, text: str, metadata: dict) -> None:
    """Add or update a memory card embedding in the space's collection."""
    if not CHROMADB_AVAILABLE or not ST_AVAILABLE:
        logger.warning("Skipping vector upsert — chromadb or sentence-transformers not installed.")
        return
    client = get_chroma_client()
    if client is None:
        return
    collection = client.get_or_create_collection(
        name=_collection_name(space_id),
        metadata={"hnsw:space": "cosine"},
    )
    embedding = embed_text(text)
    if embedding is None:
        return
    collection.upsert(
        ids=[card_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[metadata],
    )


def retrieve_relevant_memories(
    space_id: str,
    query: str,
    n_results: int = 5,
    where: dict | None = None,
) -> list[dict]:
    """
    Semantic search over approved memory cards for a given query.
    Returns list of {id, document, metadata, distance} dicts.
    Returns [] if vector store is not available.
    """
    if not CHROMADB_AVAILABLE or not ST_AVAILABLE:
        return []

    client = get_chroma_client()
    if client is None:
        return []

    col_name = _collection_name(space_id)
    try:
        collection = client.get_collection(col_name)
    except Exception:
        return []

    count = collection.count()
    if count == 0:
        return []

    query_embedding = embed_text(query)
    if query_embedding is None:
        return []

    kwargs: dict = {
        "query_embeddings": [query_embedding],
        "n_results": min(n_results, count),
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        kwargs["where"] = where

    results = collection.query(**kwargs)
    output = []
    for i in range(len(results["ids"][0])):
        output.append({
            "id": results["ids"][0][i],
            "document": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        })
    return output


def delete_space_collection(space_id: str) -> None:
    client = get_chroma_client()
    if client is None:
        return
    try:
        client.delete_collection(_collection_name(space_id))
    except Exception:
        pass
