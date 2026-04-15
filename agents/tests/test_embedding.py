"""Unit tests for the embedding provider abstraction."""

import os
import unittest
from unittest.mock import patch, MagicMock


class TestGetEmbeddingProvider(unittest.TestCase):
    def setUp(self):
        import base.embedding as mod
        mod._provider_cache = None

    @patch.dict(os.environ, {"EMBEDDING_PROVIDER": "openai", "LLM_API_KEY": "test"})
    def test_openai_provider(self):
        from base.embedding import get_embedding_provider, OpenAIEmbedding
        provider = get_embedding_provider()
        self.assertIsInstance(provider, OpenAIEmbedding)

    @patch.dict(os.environ, {"EMBEDDING_PROVIDER": "dashscope", "LLM_API_KEY": "test"})
    def test_dashscope_provider(self):
        from base.embedding import get_embedding_provider, DashScopeEmbedding
        provider = get_embedding_provider()
        self.assertIsInstance(provider, DashScopeEmbedding)

    @patch.dict(os.environ, {"EMBEDDING_PROVIDER": "zhipu", "EMBEDDING_API_KEY": "test"})
    def test_zhipu_provider(self):
        from base.embedding import get_embedding_provider, ZhipuEmbedding
        provider = get_embedding_provider()
        self.assertIsInstance(provider, ZhipuEmbedding)

    @patch.dict(os.environ, {"EMBEDDING_PROVIDER": "nonexistent", "LLM_API_KEY": "test"})
    def test_unknown_falls_back_to_openai(self):
        from base.embedding import get_embedding_provider, OpenAIEmbedding
        provider = get_embedding_provider()
        self.assertIsInstance(provider, OpenAIEmbedding)


class TestGetDimensions(unittest.TestCase):
    @patch.dict(os.environ, {"EMBEDDING_DIMENSIONS": "768"})
    def test_custom_dimensions(self):
        from base.embedding import _get_dimensions
        self.assertEqual(_get_dimensions(), 768)

    @patch.dict(os.environ, {}, clear=True)
    def test_default_dimensions(self):
        from base.embedding import _get_dimensions
        self.assertEqual(_get_dimensions(), 1536)


class TestEmbedSingle(unittest.TestCase):
    def test_embed_single_delegates(self):
        from base.embedding import EmbeddingProvider

        class FakeProvider(EmbeddingProvider):
            def embed(self, texts):
                return [[0.1, 0.2] for _ in texts]

        p = FakeProvider()
        result = p.embed_single("hello")
        self.assertEqual(result, [0.1, 0.2])


if __name__ == "__main__":
    unittest.main()
