"""Base class for agents that support LLM native function calling with tool loop."""

from __future__ import annotations

import json
import os
import re
import sys
import time
import pathlib
from datetime import datetime
from typing import Any, Generator, Optional, TextIO

from .base_agent import BaseAgent
from .protocol import (
    AgentRequest, AgentChunk, AgentToolCall, AgentResult, AgentError,
    AgentToolStart, AgentToolResult,
)
from .tools import ToolRegistry


DEFAULT_MAX_TOOL_LOOPS = 10
_LOGS_DIR = pathlib.Path(__file__).resolve().parent.parent / "logs"


def _log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S", time.localtime())
    sys.stderr.write(f"[{ts}] {msg}\n")
    sys.stderr.flush()


_ERROR_BRACKET_RE = re.compile(r"^\[[^\]]*(?:Error|错误)\]", re.IGNORECASE)


def _is_tool_result_success(result: str) -> bool:
    text = (result or "").lstrip()
    if not text:
        return True
    return _ERROR_BRACKET_RE.match(text) is None


class _LLMFileLogger:
    """Per-session file logger with human-friendly structured summaries."""

    def __init__(self, agent_label: str, session_id: str) -> None:
        _LOGS_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._user_id = (
            os.environ.get("AGENT_USER_ID")
            or os.environ.get("MEMORY_USER_ID")
            or "unknown"
        )
        self._user_email = os.environ.get("AGENT_USER_EMAIL") or ""
        user_tag = self._user_id.replace("/", "_").replace("\\", "_")[:8] or "unknown"
        filename = f"{ts}_{agent_label}_{session_id[:8]}_{user_tag}.jsonl"
        self._path = _LOGS_DIR / filename
        self._fh: Optional[TextIO] = None
        self._verbose = os.environ.get("AGENT_LOG_VERBOSE", "").lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _shorten(value: Any, max_len: int = 200) -> str:
        text = "" if value is None else str(value)
        text = " ".join(text.split())
        if len(text) <= max_len:
            return text
        return text[: max_len - 1] + "..."

    def _summarize_messages(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for i, msg in enumerate(messages):
            content = msg.get("content", "")
            tool_calls = msg.get("tool_calls")
            out.append({
                "idx": i,
                "role": msg.get("role", "unknown"),
                "chars": len(str(content or "")),
                "preview": self._shorten(content),
                "tool_calls": len(tool_calls) if isinstance(tool_calls, list) else 0,
            })
        return out

    @staticmethod
    def _summarize_tools(tools: Any) -> list[str]:
        if not isinstance(tools, list):
            return []
        names: list[str] = []
        for t in tools:
            fn = t.get("function") if isinstance(t, dict) else None
            name = fn.get("name") if isinstance(fn, dict) else None
            names.append(str(name or "unknown"))
        return names

    def _ensure_open(self) -> TextIO:
        if self._fh is None or self._fh.closed:
            self._fh = open(self._path, "a", encoding="utf-8")
        return self._fh

    def _write(self, record: dict[str, Any]) -> None:
        record["_ts"] = datetime.now().isoformat()
        record["user_id"] = self._user_id
        record["user_email"] = self._user_email
        fh = self._ensure_open()
        fh.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
        fh.flush()

    def log_request(self, loop_i: int, model: str,
                    messages: list[dict[str, Any]],
                    tools: Any) -> None:
        record: dict[str, Any] = {
            "event": "llm_request",
            "loop": loop_i,
            "model": model,
            "message_count": len(messages),
            "tool_count": len(tools) if isinstance(tools, list) else 0,
            "tool_names": self._summarize_tools(tools),
            "messages": self._summarize_messages(messages),
            # Backward-compatible keys with concise content.
            "tools": self._summarize_tools(tools),
        }
        if self._verbose:
            record["messages_full"] = messages
            record["tools_full"] = tools
        self._write(record)

    def log_response(self, loop_i: int, content: str,
                     tool_calls: list[dict[str, Any]],
                     elapsed_s: float) -> None:
        tool_call_names = [str(tc.get("name") or "unknown") for tc in tool_calls]
        record: dict[str, Any] = {
            "event": "llm_response",
            "loop": loop_i,
            "content_chars": len(content),
            "content_preview": self._shorten(content, max_len=240),
            "tool_call_count": len(tool_calls),
            "tool_call_names": tool_call_names,
            "elapsed_s": round(elapsed_s, 2),
            # Backward-compatible keys with concise content.
            "content": self._shorten(content, max_len=240),
            "tool_calls": tool_call_names,
        }
        if self._verbose:
            record["content_full"] = content
            record["tool_calls_full"] = tool_calls
        self._write(record)

    def log_tool_exec(self, loop_i: int, name: str,
                      args: dict[str, Any], result: str,
                      success: bool, elapsed_s: float) -> None:
        record: dict[str, Any] = {
            "event": "tool_exec",
            "loop": loop_i,
            "tool": name,
            "args_preview": self._shorten(json.dumps(args, ensure_ascii=False, default=str), max_len=200),
            "result_chars": len(result),
            "result_preview": self._shorten(result, max_len=240),
            "success": success,
            "elapsed_s": round(elapsed_s, 2),
            # Backward-compatible keys with concise content.
            "args": args,
            "result": self._shorten(result, max_len=240),
        }
        if self._verbose:
            record["args_full"] = args
            record["result_full"] = result
        self._write(record)

    def log_error(self, msg: str) -> None:
        self._write({"event": "error", "message": msg})

    def log_finish(self, reason: str, total_loops: int, total_s: float) -> None:
        self._write({
            "event": "finish",
            "reason": reason,
            "total_loops": total_loops,
            "total_s": round(total_s, 2),
        })

    def close(self) -> None:
        if self._fh and not self._fh.closed:
            self._fh.close()


class ToolCallableAgent(BaseAgent):
    """Agent with native OpenAI function calling and tool execution loop.

    Subclasses should:
    1. Override ``setup_tools(registry)`` to register available tools
    2. Override ``get_system_prompt()`` to define the agent's role
    3. Optionally override ``get_model()`` / ``get_max_tool_loops()``
    """

    def __init__(self) -> None:
        super().__init__()
        self._registry = ToolRegistry()
        self._llm_client: Any = None
        self.setup_tools(self._registry)
        self._setup_canvas_emit()

    def setup_tools(self, registry: ToolRegistry) -> None:
        """Override to register tools. Called once during __init__."""
        pass

    def get_system_prompt(self) -> str:
        """Override to define the agent's role and behavior."""
        return "You are a helpful assistant."

    def get_model(self) -> str:
        return os.environ.get("LLM_MODEL") or "deepseek-chat"

    def get_max_tool_loops(self) -> int:
        return DEFAULT_MAX_TOOL_LOOPS

    def _get_llm(self) -> Any:
        if self._llm_client is None:
            from openai import OpenAI
            api_key = (
                os.environ.get("LLM_API_KEY")
                or os.environ.get("DEEPSEEK_API_KEY")
            )
            if not api_key:
                raise ValueError(
                    "LLM API key required. Set LLM_API_KEY or DEEPSEEK_API_KEY."
                )
            base_url = os.environ.get("LLM_BASE_URL") or "https://api.deepseek.com"
            self._llm_client = OpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=60.0,
                max_retries=0,
            )
        return self._llm_client

    def _setup_canvas_emit(self) -> None:
        """Wire canvas tools to emit AgentToolCall events through our _emit."""
        try:
            from .tools.builtin.canvas_tools import set_emit_callback
            set_emit_callback(self._emit)
        except ImportError:
            pass

    def execute(
        self, request: AgentRequest
    ) -> Generator[BaseAgent.AgentOutput, None, None]:
        import traceback as _tb

        messages = request.messages
        if not messages:
            yield AgentError(
                content="No messages provided",
                code="INPUT_ERROR",
                phase="bootstrap",
            )
            return

        system_prompt = self.get_system_prompt()
        llm_messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt}
        ]
        for msg in messages:
            llm_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

        tool_schemas = self._registry.get_schemas() or None
        model = self.get_model()
        max_loops = self.get_max_tool_loops()

        try:
            llm = self._get_llm()
        except ValueError as e:
            yield AgentError(
                content=str(e),
                code="CONFIG_ERROR",
                phase="bootstrap",
                details={"exception_type": type(e).__name__},
            )
            return

        agent_label = self.__class__.__name__
        session_id = getattr(request, "session_id", None) or "unknown"
        flog = _LLMFileLogger(agent_label, str(session_id))
        session_t0 = time.time()

        _log(f"{agent_label} start | model={model} | tools={len(tool_schemas or [])} | log={flog._path.name}")

        try:
            for loop_i in range(max_loops):
                _log(f"{agent_label} loop {loop_i+1}/{max_loops} — calling LLM")
                flog.log_request(loop_i + 1, model, llm_messages, tool_schemas)

                t0 = time.time()
                try:
                    call_kwargs: dict[str, Any] = {
                        "model": model,
                        "messages": llm_messages,
                        "stream": True,
                    }
                    if tool_schemas:
                        call_kwargs["tools"] = tool_schemas

                    stream = llm.chat.completions.create(**call_kwargs)
                except Exception as e:
                    tb_str = _tb.format_exc()
                    _log(f"{agent_label} LLM error: {e}")
                    flog.log_error(f"LLM API error: {type(e).__name__}: {e}")
                    yield AgentError(
                        content=f"LLM API error: {type(e).__name__}: {e}",
                        code="LLM_ERROR",
                        phase="execute",
                        traceback=tb_str,
                        details={
                            "exception_type": type(e).__name__,
                            "loop": loop_i + 1,
                            "model": model,
                            "agent": agent_label,
                        },
                    )
                    return

                collected_content = ""
                collected_tool_calls: list[dict[str, Any]] = []

                try:
                    for chunk in stream:
                        delta = chunk.choices[0].delta if chunk.choices else None
                        if not delta:
                            continue

                        if delta.content:
                            collected_content += delta.content
                            yield AgentChunk(content=delta.content)

                        if delta.tool_calls:
                            for tc_delta in delta.tool_calls:
                                idx = tc_delta.index
                                while len(collected_tool_calls) <= idx:
                                    collected_tool_calls.append(
                                        {"id": "", "name": "", "arguments": ""}
                                    )
                                entry = collected_tool_calls[idx]
                                if tc_delta.id:
                                    entry["id"] = tc_delta.id
                                if tc_delta.function:
                                    if tc_delta.function.name:
                                        entry["name"] = tc_delta.function.name
                                    if tc_delta.function.arguments:
                                        entry["arguments"] += tc_delta.function.arguments

                except Exception as e:
                    tb_str = _tb.format_exc()
                    flog.log_error(f"LLM streaming error: {type(e).__name__}: {e}")
                    yield AgentError(
                        content=f"LLM streaming error: {type(e).__name__}: {e}",
                        code="LLM_STREAM_ERROR",
                        phase="execute",
                        traceback=tb_str,
                        details={
                            "exception_type": type(e).__name__,
                            "loop": loop_i + 1,
                            "model": model,
                            "agent": agent_label,
                            "partial_text_chars": len(collected_content),
                        },
                    )
                    return

                elapsed = time.time() - t0
                _log(f"{agent_label} loop {loop_i+1} LLM done in {elapsed:.1f}s | text={len(collected_content)}ch | tool_calls={len(collected_tool_calls)}")
                flog.log_response(loop_i + 1, collected_content, collected_tool_calls, elapsed)

                if not collected_tool_calls:
                    _log(f"{agent_label} finished (no more tool calls)")
                    flog.log_finish("completed", loop_i + 1, time.time() - session_t0)
                    yield AgentResult(content=collected_content)
                    return

                assistant_msg: dict[str, Any] = {"role": "assistant", "content": collected_content or None}
                assistant_msg["tool_calls"] = [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": tc["arguments"],
                        },
                    }
                    for tc in collected_tool_calls
                ]
                llm_messages.append(assistant_msg)

                for tc in collected_tool_calls:
                    fn_name = tc["name"]
                    try:
                        fn_args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                    except json.JSONDecodeError:
                        fn_args = {}

                    _log(f"{agent_label} tool exec: {fn_name}({list(fn_args.keys())})")
                    t1 = time.time()
                    yield AgentToolStart(name=fn_name, args=fn_args)
                    result_str = self._registry.execute(fn_name, fn_args)
                    success = _is_tool_result_success(result_str)
                    tool_elapsed = time.time() - t1
                    _log(f"{agent_label} tool done: {fn_name} in {tool_elapsed:.1f}s | ok={success} | len={len(result_str)}")
                    flog.log_tool_exec(loop_i + 1, fn_name, fn_args, result_str, success, tool_elapsed)
                    yield AgentToolResult(name=fn_name, result=result_str, success=success)

                    llm_messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result_str,
                    })

            flog.log_finish("tool_loop_limit", max_loops, time.time() - session_t0)
            yield AgentError(
                content=f"Tool loop limit reached ({max_loops} iterations). Stopping.",
                code="TOOL_LOOP_LIMIT",
                phase="execute",
                details={"max_loops": max_loops, "agent": agent_label},
            )
        finally:
            flog.close()
