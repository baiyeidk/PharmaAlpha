"""Lightweight token estimation without external tokenizer dependencies.

Uses per-character language classification:
  - ASCII (ord < 128): ~0.3 tokens per character
  - Non-ASCII (Chinese etc.): ~1.5 tokens per character
"""

from __future__ import annotations

import math
from typing import Any

ASCII_COEFF = 0.3
NON_ASCII_COEFF = 1.5
MESSAGE_OVERHEAD = 4  # role separator + framing


def estimate_tokens(text: str) -> int:
    """Estimate token count for a single string."""
    if not text:
        return 0
    ascii_count = sum(1 for ch in text if ord(ch) < 128)
    non_ascii_count = len(text) - ascii_count
    return math.ceil(ascii_count * ASCII_COEFF + non_ascii_count * NON_ASCII_COEFF)


def estimate_messages_tokens(messages: list[dict[str, Any]]) -> int:
    """Estimate total token count for a list of LLM messages."""
    total = 0
    for msg in messages:
        content = msg.get("content") or ""
        total += estimate_tokens(content) + MESSAGE_OVERHEAD
    return total
