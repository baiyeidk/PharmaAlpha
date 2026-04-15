"""Unit tests for the recursive chunker."""

import unittest
from base.rag.chunker import recursive_chunk, Chunk


class TestRecursiveChunk(unittest.TestCase):
    def test_short_text_single_chunk(self):
        chunks = recursive_chunk("Hello world", chunk_size=100)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].content, "Hello world")
        self.assertEqual(chunks[0].index, 0)

    def test_paragraph_splitting(self):
        text = ("段落一。" * 200) + "\n\n" + ("段落二。" * 200)
        chunks = recursive_chunk(text, chunk_size=200, overlap=20)
        self.assertGreater(len(chunks), 1)
        for c in chunks:
            self.assertIsInstance(c, Chunk)
            self.assertTrue(len(c.content) > 0)

    def test_metadata_preserved(self):
        chunks = recursive_chunk("Test content", metadata={"page": 1, "source": "test.pdf"})
        self.assertEqual(chunks[0].metadata["page"], 1)

    def test_empty_text(self):
        chunks = recursive_chunk("")
        self.assertEqual(len(chunks), 0)

    def test_overlap_exists(self):
        long_text = "这是一段很长的测试文本。" * 100
        chunks = recursive_chunk(long_text, chunk_size=50, overlap=10)
        if len(chunks) >= 2:
            end_of_first = chunks[0].content[-20:]
            self.assertTrue(
                any(c in chunks[1].content for c in end_of_first if len(c.strip()) > 0),
                "Overlap should cause some content from end of chunk 0 to appear in chunk 1"
            )

    def test_chunk_indices_sequential(self):
        text = "段落。\n\n" * 50
        chunks = recursive_chunk(text, chunk_size=30)
        for i, c in enumerate(chunks):
            self.assertEqual(c.index, i)


if __name__ == "__main__":
    unittest.main()
