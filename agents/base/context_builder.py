"""Unified context assembler for LLM calls.

Manages system prompts, chat history, phase-specific injections,
environment context, and token budget guards with observability.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from .token_estimation import estimate_tokens, estimate_messages_tokens

logger = logging.getLogger("context_builder")

DEFAULT_MAX_TOKENS = 40_000
TOOL_RESULT_MAX_CHARS = 2_000
MIN_KEEP_USER_MESSAGES = 2


def _get_budget() -> int:
    env_val = os.environ.get("CONTEXT_BUDGET_TOKENS")
    if env_val:
        try:
            return int(env_val)
        except ValueError:
            pass
    return DEFAULT_MAX_TOKENS


class ContextBuilder:
    """Declarative builder for LLM message lists with budget enforcement."""

    def __init__(self, max_tokens: int | None = None) -> None:
        self._max_tokens = max_tokens if max_tokens is not None else _get_budget()
        self._system: str | None = None
        self._messages: list[dict[str, Any]] = []
        self._memory: list[dict[str, Any]] = []
        self._environment: list[dict[str, Any]] = []
        self._phase_context: list[dict[str, Any]] = []

    def set_system(self, prompt: str) -> "ContextBuilder":
        self._system = prompt
        return self

    def add_messages(self, messages: list[dict[str, Any]]) -> "ContextBuilder":
        self._messages = [{**m, "_tag": "chat_history"} for m in messages]
        return self

    def inject_memory(self, memory_text: str) -> "ContextBuilder":
        """Inject recalled memory as system context."""
        self._memory.clear()
        if memory_text:
            self._memory.append({
                "role": "system",
                "content": f"## 用户历史记忆\n{memory_text}",
                "_tag": "env_context",
            })
        return self

    def inject_rag_context(self, rag_text: str) -> "ContextBuilder":
        """Inject pre-searched RAG results so Plan knows what data is already available."""
        if rag_text:
            self._memory.append({
                "role": "system",
                "content": f"## 知识库中已有的相关数据（无需重复获取）\n{rag_text}",
                "_tag": "env_context",
            })
        return self

    def inject_environment(
        self,
        *,
        canvas_history: list[dict[str, Any]] | None = None,
        current_time: bool = True,
    ) -> "ContextBuilder":
        self._environment.clear()

        if current_time:
            ts = time.strftime("%Y-%m-%d %H:%M", time.localtime())
            self._environment.append({
                "role": "system",
                "content": f"当前时间: {ts}",
                "_tag": "env_context",
            })

        if canvas_history:
            items = []
            for h in canvas_history:
                if h.get("tickers"):
                    items.append(f"- 走势图: {h.get('label', '')} (股票: {', '.join(h['tickers'])})")
                else:
                    items.append(f"- 文本节点: {h.get('label', '')}")
            self._environment.append({
                "role": "system",
                "content": "## 画布上已有的内容（不要重复添加）\n" + "\n".join(items),
                "_tag": "env_context",
            })

        return self

    def inject_phase_context(self, *parts: str, replace: bool = False) -> "ContextBuilder":
        if replace:
            self._phase_context.clear()
        for part in parts:
            if part:
                self._phase_context.append({
                    "role": "user",
                    "content": part,
                    "_tag": "phase_inject",
                })
        return self

    def build(self) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []

        if self._system:
            result.append({"role": "system", "content": self._system, "_tag": "system_prompt"})

        result.extend(self._memory)
        result.extend(self._environment)
        result.extend(self._messages)
        result.extend(self._phase_context)

        truncated = self._apply_budget(result)

        token_total = estimate_messages_tokens(result)
        logger.debug(
            "budget_enforced | messages=%d | est_tokens=%d | truncated=%s",
            len(result), token_total, truncated,
        )

        for msg in result:
            msg.pop("_tag", None)

        return result

    # ── Budget enforcement ────────────────────────────────

    def _apply_budget(self, messages: list[dict[str, Any]]) -> bool:
        truncated = False

        for msg in messages:
            if msg.get("_tag") == "tool_result" or msg.get("role") == "tool":
                content = msg.get("content", "")
                if len(content) > TOOL_RESULT_MAX_CHARS:
                    orig_len = len(content)
                    msg["content"] = content[:TOOL_RESULT_MAX_CHARS] + "\n\n[...已截断]"
                    logger.debug(
                        "tool_result_truncated | orig=%d | after=%d",
                        orig_len, len(msg["content"]),
                    )
                    truncated = True

        total = estimate_messages_tokens(messages)
        if total <= self._max_tokens:
            return truncated

        protected_tags = {"system_prompt", "env_context", "phase_inject"}

        user_chat_indices = [
            i for i, m in enumerate(messages)
            if m.get("_tag") == "chat_history" and m.get("role") == "user"
        ]

        keep_boundary = max(0, len(user_chat_indices) - MIN_KEEP_USER_MESSAGES)

        removable = []
        for i, m in enumerate(messages):
            tag = m.get("_tag", "")
            if tag in protected_tags:
                continue
            if tag == "chat_history" and m.get("role") == "user":
                idx_pos = user_chat_indices.index(i) if i in user_chat_indices else -1
                if idx_pos >= keep_boundary:
                    continue
            removable.append(i)

        to_remove: set[int] = set()
        for idx in removable:
            if total <= self._max_tokens:
                break
            content = messages[idx].get("content") or ""
            total -= estimate_tokens(content) + 4
            logger.debug(
                "message_removed | role=%s | preview=%.50s",
                messages[idx].get("role", "?"),
                (messages[idx].get("content") or "")[:50],
            )
            to_remove.add(idx)
            truncated = True

        for idx in sorted(to_remove, reverse=True):
            messages.pop(idx)

        return truncated
