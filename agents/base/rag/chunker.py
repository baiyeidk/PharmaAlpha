"""Recursive text chunker for RAG pipeline.

Splits text hierarchically: paragraphs -> sentences -> characters,
preserving semantic boundaries wherever possible.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from base.token_estimation import estimate_tokens

DEFAULT_CHUNK_SIZE = 512
DEFAULT_OVERLAP = 64

PARAGRAPH_SEPARATORS = ["\n\n", "\n"]
SENTENCE_SEPARATORS = [
    "。", "！", "？", "；",
    ". ", "! ", "? ", "; ",
    "\n",
]


@dataclass
class Chunk:
    content: str
    index: int
    metadata: dict[str, Any] = field(default_factory=dict)


def recursive_chunk(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
    metadata: dict[str, Any] | None = None,
) -> list[Chunk]:
    """Split text into chunks of approximately `chunk_size` tokens with `overlap`."""
    if not text.strip():
        return []

    base_meta = metadata or {}
    segments = _split_by_separators(text, PARAGRAPH_SEPARATORS)

    chunks: list[Chunk] = []
    current_text = ""
    chunk_idx = 0

    for segment in segments:
        seg_tokens = estimate_tokens(segment)

        if seg_tokens > chunk_size:
            if current_text.strip():
                chunks.append(Chunk(content=current_text.strip(), index=chunk_idx, metadata={**base_meta}))
                chunk_idx += 1
                current_text = _get_overlap_text(current_text, overlap)

            sub_segments = _split_by_separators(segment, SENTENCE_SEPARATORS)
            for sub in sub_segments:
                sub_tokens = estimate_tokens(sub)
                if sub_tokens > chunk_size:
                    if current_text.strip():
                        chunks.append(Chunk(content=current_text.strip(), index=chunk_idx, metadata={**base_meta}))
                        chunk_idx += 1
                        current_text = _get_overlap_text(current_text, overlap)
                    for char_chunk in _split_by_chars(sub, chunk_size, overlap):
                        chunks.append(Chunk(content=char_chunk.strip(), index=chunk_idx, metadata={**base_meta}))
                        chunk_idx += 1
                    current_text = ""
                elif estimate_tokens(current_text + sub) > chunk_size:
                    if current_text.strip():
                        chunks.append(Chunk(content=current_text.strip(), index=chunk_idx, metadata={**base_meta}))
                        chunk_idx += 1
                        current_text = _get_overlap_text(current_text, overlap)
                    current_text += sub
                else:
                    current_text += sub
            continue

        if estimate_tokens(current_text + segment) > chunk_size:
            if current_text.strip():
                chunks.append(Chunk(content=current_text.strip(), index=chunk_idx, metadata={**base_meta}))
                chunk_idx += 1
                current_text = _get_overlap_text(current_text, overlap)

        current_text += segment

    if current_text.strip():
        chunks.append(Chunk(content=current_text.strip(), index=chunk_idx, metadata={**base_meta}))

    return chunks


def _split_by_separators(text: str, separators: list[str]) -> list[str]:
    """Split text by the first separator that produces multiple parts."""
    for sep in separators:
        parts = text.split(sep)
        if len(parts) > 1:
            return [p + sep for p in parts[:-1]] + [parts[-1]]
    return [text]


def _get_overlap_text(text: str, overlap_tokens: int) -> str:
    """Get the last `overlap_tokens` worth of text for overlap."""
    if overlap_tokens <= 0:
        return ""
    chars = text[-overlap_tokens * 4:]
    while estimate_tokens(chars) > overlap_tokens and len(chars) > 10:
        chars = chars[len(chars) // 4:]
    return chars


def _split_by_chars(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Last resort: split by character count approximation."""
    chars_per_chunk = chunk_size * 3
    overlap_chars = overlap * 3
    results = []
    start = 0
    while start < len(text):
        end = min(start + chars_per_chunk, len(text))
        results.append(text[start:end])
        start = end - overlap_chars if end < len(text) else end
    return results
