"""Unified embedding provider abstraction.

Supports OpenAI, DashScope (Qwen), Zhipu, and local BGE models.
Provider is selected via EMBEDDING_PROVIDER env var.
"""

from __future__ import annotations

import logging
import os
import time
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger("embedding")

BATCH_LIMIT = 10
TIMEOUT_SECONDS = 30
DEFAULT_DIMENSIONS = 1024


def _get_dimensions() -> int:
    val = os.environ.get("EMBEDDING_DIMENSIONS")
    if val:
        try:
            return int(val)
        except ValueError:
            pass
    return DEFAULT_DIMENSIONS


class EmbeddingProvider(ABC):
    """Base class for all embedding providers."""

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float] | None]:
        """Return a list of embedding vectors (or None on per-item failure)."""
        ...

    def embed_single(self, text: str) -> list[float] | None:
        results = self.embed([text])
        return results[0] if results else None


class OpenAIEmbedding(EmbeddingProvider):
    """OpenAI text-embedding-3-small (or compatible API like DashScope)."""

    def __init__(self) -> None:
        from openai import OpenAI

        api_key = os.environ.get("EMBEDDING_API_KEY") or os.environ.get("LLM_API_KEY", "")
        base_url = os.environ.get("EMBEDDING_BASE_URL") or os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
        self._model = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
        self._dims = _get_dimensions()
        self._client = OpenAI(api_key=api_key, base_url=base_url, timeout=TIMEOUT_SECONDS)

    def embed(self, texts: list[str]) -> list[list[float] | None]:
        results: list[list[float] | None] = []
        for i in range(0, len(texts), BATCH_LIMIT):
            batch = texts[i : i + BATCH_LIMIT]
            try:
                resp = self._client.embeddings.create(
                    model=self._model,
                    input=batch,
                    dimensions=self._dims,
                )
                for item in resp.data:
                    results.append(item.embedding)
            except Exception as e:
                logger.warning("OpenAI embedding batch failed: %s", e)
                results.extend([None] * len(batch))
        return results


class DashScopeEmbedding(EmbeddingProvider):
    """DashScope (Qwen) embedding via OpenAI-compatible API."""

    def __init__(self) -> None:
        from openai import OpenAI

        api_key = os.environ.get("EMBEDDING_API_KEY") or os.environ.get("LLM_API_KEY", "")
        base_url = os.environ.get("EMBEDDING_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
        self._model = os.environ.get("EMBEDDING_MODEL", "text-embedding-v4")
        self._dims = _get_dimensions()
        self._client = OpenAI(api_key=api_key, base_url=base_url, timeout=TIMEOUT_SECONDS)

    def embed(self, texts: list[str]) -> list[list[float] | None]:
        results: list[list[float] | None] = []
        for i in range(0, len(texts), BATCH_LIMIT):
            batch = texts[i : i + BATCH_LIMIT]
            try:
                resp = self._client.embeddings.create(
                    model=self._model,
                    input=batch,
                    dimensions=self._dims,
                )
                for item in resp.data:
                    results.append(item.embedding)
            except Exception as e:
                logger.warning("DashScope embedding batch failed: %s", e)
                results.extend([None] * len(batch))
        return results


class ZhipuEmbedding(EmbeddingProvider):
    """Zhipu embedding-3 via OpenAI-compatible API."""

    def __init__(self) -> None:
        from openai import OpenAI

        api_key = os.environ.get("EMBEDDING_API_KEY", "")
        self._model = os.environ.get("EMBEDDING_MODEL", "embedding-3")
        self._dims = _get_dimensions()
        self._client = OpenAI(
            api_key=api_key,
            base_url="https://open.bigmodel.cn/api/paas/v4/",
            timeout=TIMEOUT_SECONDS,
        )

    def embed(self, texts: list[str]) -> list[list[float] | None]:
        results: list[list[float] | None] = []
        for i in range(0, len(texts), BATCH_LIMIT):
            batch = texts[i : i + BATCH_LIMIT]
            try:
                resp = self._client.embeddings.create(
                    model=self._model,
                    input=batch,
                    dimensions=self._dims,
                )
                for item in resp.data:
                    results.append(item.embedding)
            except Exception as e:
                logger.warning("Zhipu embedding batch failed: %s", e)
                results.extend([None] * len(batch))
        return results


class LocalBGEEmbedding(EmbeddingProvider):
    """Local BGE-small-zh via sentence-transformers."""

    def __init__(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise ImportError("sentence-transformers is required for local embedding. pip install sentence-transformers")

        model_name = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5")
        logger.info("Loading local embedding model: %s", model_name)
        start = time.time()
        self._model = SentenceTransformer(model_name)
        logger.info("Model loaded in %.1fs", time.time() - start)

    def embed(self, texts: list[str]) -> list[list[float] | None]:
        try:
            vectors = self._model.encode(texts, normalize_embeddings=True)
            return [v.tolist() for v in vectors]
        except Exception as e:
            logger.warning("Local embedding failed: %s", e)
            return [None] * len(texts)


_provider_cache: Optional[EmbeddingProvider] = None


def get_embedding_provider() -> EmbeddingProvider:
    """Factory: return the configured EmbeddingProvider singleton."""
    global _provider_cache
    if _provider_cache is not None:
        return _provider_cache

    provider_name = os.environ.get("EMBEDDING_PROVIDER", "openai").lower()

    providers = {
        "openai": OpenAIEmbedding,
        "dashscope": DashScopeEmbedding,
        "zhipu": ZhipuEmbedding,
        "local": LocalBGEEmbedding,
    }

    cls = providers.get(provider_name)
    if cls is None:
        logger.warning("Unknown EMBEDDING_PROVIDER=%s, falling back to openai", provider_name)
        cls = OpenAIEmbedding

    try:
        _provider_cache = cls()
    except Exception as e:
        logger.error("Failed to initialize embedding provider %s: %s", provider_name, e)
        raise

    return _provider_cache
