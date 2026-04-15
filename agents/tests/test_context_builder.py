"""Unit tests for ContextBuilder."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.context_builder import ContextBuilder, TOOL_RESULT_MAX_CHARS
from base.token_estimation import estimate_tokens


def test_basic_build():
    ctx = ContextBuilder()
    ctx.set_system("You are helpful.")
    ctx.add_messages([{"role": "user", "content": "Hello"}])
    msgs = ctx.build()
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    assert msgs[1]["role"] == "user"


def test_environment_injection():
    ctx = ContextBuilder()
    ctx.set_system("system")
    ctx.add_messages([{"role": "user", "content": "hi"}])
    ctx.inject_environment(
        canvas_history=[{"tool": "canvas_add_chart", "label": "Test", "tickers": ["600276"]}],
        current_time=True,
    )
    msgs = ctx.build()
    roles = [m["role"] for m in msgs]
    assert roles.count("system") == 3
    assert any("当前时间" in m["content"] for m in msgs if m["role"] == "system")
    assert any("画布上已有" in m["content"] for m in msgs if m["role"] == "system")


def test_no_environment_when_empty():
    ctx = ContextBuilder()
    ctx.set_system("s")
    ctx.add_messages([{"role": "user", "content": "hi"}])
    ctx.inject_environment(canvas_history=None, current_time=False)
    msgs = ctx.build()
    assert len(msgs) == 2


def test_phase_context_injection():
    ctx = ContextBuilder()
    ctx.set_system("s")
    ctx.add_messages([{"role": "user", "content": "hi"}])
    ctx.inject_phase_context("step 1", "step 2")
    msgs = ctx.build()
    assert len(msgs) == 4
    assert msgs[-2]["content"] == "step 1"
    assert msgs[-1]["content"] == "step 2"


def test_tool_result_truncation():
    long_content = "x" * 5000
    ctx = ContextBuilder()
    ctx.set_system("s")
    ctx.add_messages([
        {"role": "user", "content": "q"},
        {"role": "tool", "content": long_content},
    ])
    msgs = ctx.build()
    tool_msg = next(m for m in msgs if m["role"] == "tool")
    assert len(tool_msg["content"]) <= TOOL_RESULT_MAX_CHARS + 20
    assert tool_msg["content"].endswith("[...已截断]")


def test_budget_removes_old_messages():
    ctx = ContextBuilder(max_tokens=80)
    ctx.set_system("sys")
    ctx.add_messages([
        {"role": "user", "content": "a" * 50},
        {"role": "assistant", "content": "b" * 50},
        {"role": "user", "content": "c" * 50},
        {"role": "assistant", "content": "d" * 50},
        {"role": "user", "content": "recent question"},
    ])
    msgs = ctx.build()
    assert msgs[0]["role"] == "system"
    assert any("recent question" in m.get("content", "") for m in msgs)


def test_system_prompt_never_truncated():
    long_system = "s" * 150
    ctx = ContextBuilder(max_tokens=60)
    ctx.set_system(long_system)
    ctx.add_messages([
        {"role": "user", "content": "a" * 100},
        {"role": "user", "content": "b" * 100},
    ])
    msgs = ctx.build()
    assert msgs[0]["content"] == long_system


def test_no_tag_in_output():
    """Build output must not leak _tag fields."""
    ctx = ContextBuilder()
    ctx.set_system("system prompt")
    ctx.add_messages([{"role": "user", "content": "hello"}])
    ctx.inject_environment(current_time=True)
    ctx.inject_phase_context("phase data")
    msgs = ctx.build()
    for m in msgs:
        assert "_tag" not in m, f"_tag leaked in message: {m}"


def test_tag_based_truncation():
    """Tool results tagged with _tag='tool_result' should be truncated by budget."""
    ctx = ContextBuilder(max_tokens=100)
    ctx.set_system("s")
    msgs_input = [
        {"role": "user", "content": "q"},
        {"role": "tool", "content": "x" * 5000, "_tag": "tool_result"},
    ]
    ctx.add_messages(msgs_input)
    msgs = ctx.build()
    tool_msg = next((m for m in msgs if m["role"] == "tool"), None)
    if tool_msg:
        assert len(tool_msg["content"]) <= TOOL_RESULT_MAX_CHARS + 20


def test_env_budget_override():
    """CONTEXT_BUDGET_TOKENS env var overrides default."""
    os.environ["CONTEXT_BUDGET_TOKENS"] = "100"
    try:
        ctx = ContextBuilder()
        assert ctx._max_tokens == 100
    finally:
        del os.environ["CONTEXT_BUDGET_TOKENS"]


if __name__ == "__main__":
    test_basic_build()
    test_environment_injection()
    test_no_environment_when_empty()
    test_phase_context_injection()
    test_tool_result_truncation()
    test_budget_removes_old_messages()
    test_system_prompt_never_truncated()
    test_no_tag_in_output()
    test_tag_based_truncation()
    test_env_budget_override()
    print("All context builder tests passed!")
