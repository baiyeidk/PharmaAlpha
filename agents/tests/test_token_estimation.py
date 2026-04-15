"""Unit tests for token estimation."""

import sys
import os
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.token_estimation import estimate_tokens, estimate_messages_tokens


def test_pure_english():
    assert estimate_tokens("Hello World") == math.ceil(11 * 0.3)  # 4


def test_pure_chinese():
    assert estimate_tokens("你好世界") == math.ceil(4 * 1.5)  # 6


def test_mixed():
    text = "分析 AAPL 股票"
    ascii_chars = sum(1 for ch in text if ord(ch) < 128)  # " AAPL " = 6
    non_ascii = len(text) - ascii_chars  # 4
    expected = math.ceil(ascii_chars * 0.3 + non_ascii * 1.5)
    assert estimate_tokens(text) == expected


def test_empty_string():
    assert estimate_tokens("") == 0


def test_messages_tokens():
    msgs = [
        {"role": "system", "content": "a" * 100},
        {"role": "user", "content": "b" * 100},
        {"role": "assistant", "content": "c" * 100},
    ]
    expected = 3 * (math.ceil(100 * 0.3) + 4)  # 3 * (30 + 4) = 102
    assert estimate_messages_tokens(msgs) == expected


def test_messages_with_none_content():
    msgs = [{"role": "assistant", "content": None}]
    assert estimate_messages_tokens(msgs) == 4  # just overhead


if __name__ == "__main__":
    test_pure_english()
    test_pure_chinese()
    test_mixed()
    test_empty_string()
    test_messages_tokens()
    test_messages_with_none_content()
    print("All token estimation tests passed!")
