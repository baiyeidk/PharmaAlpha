"""PEC (Plan-Execute-Check) Agent — single-process loop with unified tool pool."""

from __future__ import annotations

import json
import os
import re
import sys
import time
from typing import Any, Generator

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.base_agent import BaseAgent
from base.protocol import (
    AgentRequest, AgentChunk, AgentResult, AgentError,
    AgentToolStart, AgentToolResult, AgentPlan, AgentCheck,
    AgentToolCall, PhaseStart, PhaseEnd, Timing,
)
from base.tools import ToolRegistry
from base.tools.builtin import (
    register_stock_tools, register_financial_tools,
    register_web_tools, register_pdf_tools,
    register_memory_tools, register_rag_tools,
    register_report_tools,
)
from base.tools.builtin.canvas_tools import (
    canvas_add_chart, canvas_add_text, set_emit_callback,
    init_dedup_from_canvas,
)
from base.tool_callable_agent import _LLMFileLogger, _log
from base.context_builder import ContextBuilder
from base.token_estimation import estimate_messages_tokens

from supervisor_agent.prompts import (
    build_plan_prompt, build_execute_prompt,
    build_check_prompt, build_synthesize_prompt,
)

MAX_PEC_ROUNDS = 3
MAX_TOOL_LOOPS = 10
RUNTIME_BUDGET_RATIO = 0.8
TOOL_TRUNC_HEAD = 500
TOOL_TRUNC_TAIL = 500
ERROR_BRACKET_RE = re.compile(r"^\[[^\]]*(?:Error|错误)\]", re.IGNORECASE)


class PECAgent(BaseAgent):
    """Single-process Plan-Execute-Check loop agent."""

    def __init__(self) -> None:
        super().__init__()
        self._llm_client: Any = None

        self._exec_registry = ToolRegistry()
        register_stock_tools(self._exec_registry)
        register_financial_tools(self._exec_registry)
        register_web_tools(self._exec_registry)
        register_pdf_tools(self._exec_registry)
        register_memory_tools(self._exec_registry)
        register_rag_tools(self._exec_registry)
        register_report_tools(self._exec_registry)
        self._exec_registry.register(canvas_add_chart)
        self._exec_registry.register(canvas_add_text)

        self._synth_registry = ToolRegistry()
        self._synth_registry.register(canvas_add_chart)
        self._synth_registry.register(canvas_add_text)

        self._canvas_history: list[dict[str, Any]] = []

        set_emit_callback(self._emit)

    def _get_llm(self) -> Any:
        if self._llm_client is None:
            from openai import OpenAI
            api_key = os.environ.get("LLM_API_KEY") or os.environ.get("DEEPSEEK_API_KEY")
            if not api_key:
                raise ValueError("LLM API key required. Set LLM_API_KEY or DEEPSEEK_API_KEY.")
            base_url = os.environ.get("LLM_BASE_URL") or "https://api.deepseek.com"
            self._llm_client = OpenAI(api_key=api_key, base_url=base_url, timeout=120.0, max_retries=0)
        return self._llm_client

    def _get_model(self) -> str:
        return os.environ.get("LLM_MODEL") or "deepseek-chat"

    @staticmethod
    def _is_tool_result_success(result: str) -> bool:
        text = (result or "").lstrip()
        if not text:
            return True
        return ERROR_BRACKET_RE.match(text) is None

    # ── LLM call helpers ────────────────────────────────────

    @staticmethod
    def _normalize_llm_json_content(content: str) -> dict[str, Any]:
        """Parse model JSON output robustly, including quoted-JSON edge cases."""
        raw = (content or "").strip()
        if not raw:
            return {}

        cleaned = raw
        if cleaned.startswith("```"):
            cleaned = cleaned.replace("```json", "").replace("```", "").strip()

        try:
            parsed: Any = json.loads(cleaned)
        except json.JSONDecodeError:
            return {"error": "Invalid JSON from LLM", "raw": raw}

        # Some models return a JSON-string that itself contains JSON text.
        if isinstance(parsed, str):
            nested = parsed.strip()
            try:
                nested_obj = json.loads(nested)
                if isinstance(nested_obj, dict):
                    return nested_obj
                return {"error": "LLM returned non-object JSON payload", "raw": raw}
            except json.JSONDecodeError:
                return {"error": "LLM returned quoted non-JSON string", "raw": raw}

        if isinstance(parsed, dict):
            return parsed

        return {"error": "LLM returned non-object JSON payload", "raw": raw}

    def _call_llm_json(
        self, system_prompt: str, messages: list[dict[str, Any]], flog: _LLMFileLogger, phase: str, round_i: int,
    ) -> tuple[dict[str, Any], int]:
        """Non-streaming LLM call that returns parsed JSON.

        Returns:
            (parsed_dict, elapsed_ms): parsed JSON object and call latency in ms.
        """
        model = self._get_model()
        llm = self._get_llm()

        llm_messages = [{"role": "system", "content": system_prompt}] + messages

        flog.log_request(round_i, model, llm_messages, None)
        _log(f"PECAgent {phase} round={round_i} — calling LLM (json)")
        t0 = time.perf_counter()

        try:
            resp = llm.chat.completions.create(
                model=model,
                messages=llm_messages,
                response_format={"type": "json_object"},
            )
        except Exception as e:
            flog.log_error(f"{phase} LLM error: {e}")
            raise

        content = resp.choices[0].message.content or "{}"
        elapsed = time.perf_counter() - t0
        _log(f"PECAgent {phase} done in {elapsed:.1f}s | len={len(content)}")
        flog.log_response(round_i, content, [], elapsed)

        return self._normalize_llm_json_content(content), int(elapsed * 1000)

    def _run_tool_loop(
        self, system_prompt: str, messages: list[dict[str, Any]],
        registry: ToolRegistry, flog: _LLMFileLogger, phase: str, round_i: int,
    ) -> Generator[BaseAgent.AgentOutput, None, str]:
        """Streaming LLM tool loop. Yields events, returns collected text."""
        model = self._get_model()
        llm = self._get_llm()
        tool_schemas = registry.get_schemas() or None

        llm_messages = [{"role": "system", "content": system_prompt}] + messages

        collected_all_text = ""

        for loop_i in range(MAX_TOOL_LOOPS):
            flog.log_request(round_i, model, llm_messages, tool_schemas)
            _log(f"PECAgent {phase} loop {loop_i+1}/{MAX_TOOL_LOOPS} — calling LLM")
            t0 = time.perf_counter()

            try:
                call_kwargs: dict[str, Any] = {"model": model, "messages": llm_messages, "stream": True}
                if tool_schemas:
                    call_kwargs["tools"] = tool_schemas
                stream = llm.chat.completions.create(**call_kwargs)
            except Exception as e:
                flog.log_error(f"{phase} LLM error: {e}")
                yield AgentError(content=f"LLM API error: {e}", code="LLM_ERROR")
                return ""

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
                                collected_tool_calls.append({"id": "", "name": "", "arguments": ""})
                            entry = collected_tool_calls[idx]
                            if tc_delta.id:
                                entry["id"] = tc_delta.id
                            if tc_delta.function:
                                if tc_delta.function.name:
                                    entry["name"] = tc_delta.function.name
                                if tc_delta.function.arguments:
                                    entry["arguments"] += tc_delta.function.arguments
            except Exception as e:
                flog.log_error(f"{phase} stream error: {e}")
                yield AgentError(content=f"LLM stream error: {e}", code="LLM_STREAM_ERROR")
                return ""

            elapsed = time.perf_counter() - t0
            _log(f"PECAgent {phase} loop {loop_i+1} done in {elapsed:.1f}s | text={len(collected_content)}ch | tools={len(collected_tool_calls)}")
            flog.log_response(round_i, collected_content, collected_tool_calls, elapsed)

            yield Timing(
                phase="llm_call",
                round=round_i,
                elapsed_ms=int(elapsed * 1000),
                metadata={
                    "phase_owner": phase,
                    "loop": loop_i + 1,
                    "stream": True,
                    "text_chars": len(collected_content),
                    "tool_calls": len(collected_tool_calls),
                },
            )

            collected_all_text += collected_content

            if not collected_tool_calls:
                return collected_all_text

            assistant_msg: dict[str, Any] = {"role": "assistant", "content": collected_content or None}
            assistant_msg["tool_calls"] = [
                {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": tc["arguments"]}}
                for tc in collected_tool_calls
            ]
            llm_messages.append(assistant_msg)

            for tc in collected_tool_calls:
                fn_name = tc["name"]
                try:
                    fn_args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                except json.JSONDecodeError:
                    fn_args = {}

                _log(f"PECAgent {phase} tool: {fn_name}({list(fn_args.keys())})")
                t1 = time.perf_counter()
                yield AgentToolStart(name=fn_name, args=fn_args)
                result_str = registry.execute(fn_name, fn_args)
                success = self._is_tool_result_success(result_str)
                tool_elapsed = time.perf_counter() - t1
                _log(f"PECAgent {phase} tool done: {fn_name} in {tool_elapsed:.1f}s | ok={success}")
                flog.log_tool_exec(round_i, fn_name, fn_args, result_str, success, tool_elapsed)
                yield AgentToolResult(name=fn_name, result=result_str, success=success)
                yield Timing(
                    phase="tool_call",
                    round=round_i,
                    elapsed_ms=int(tool_elapsed * 1000),
                    metadata={
                        "phase_owner": phase,
                        "tool_name": fn_name,
                        "success": success,
                    },
                )
                status_text = "OK" if success else "ERROR"
                collected_all_text += f"\n[TOOL:{status_text}] {fn_name}\n{result_str}\n"

                if success and fn_name.startswith("canvas_"):
                    entry = {"tool": fn_name, "label": fn_args.get("label", "")}
                    if "tickers" in fn_args:
                        entry["tickers"] = fn_args["tickers"]
                    self._canvas_history.append(entry)

                llm_messages.append({"role": "tool", "tool_call_id": tc["id"], "content": result_str})

            # ── Runtime budget guard ──
            budget = int(os.environ.get("CONTEXT_BUDGET_TOKENS", "40000"))
            threshold = int(budget * RUNTIME_BUDGET_RATIO)
            est_before = estimate_messages_tokens(llm_messages)
            if est_before > threshold:
                last_tool_idx = max(
                    (i for i, m in enumerate(llm_messages) if m.get("role") == "tool"),
                    default=-1,
                )
                truncated_indices = []
                for i, m in enumerate(llm_messages):
                    if m.get("role") != "tool" or i == last_tool_idx:
                        continue
                    content = m.get("content", "")
                    if len(content) > TOOL_TRUNC_HEAD + TOOL_TRUNC_TAIL + 20:
                        m["content"] = (
                            content[:TOOL_TRUNC_HEAD]
                            + "\n\n[...已截断]\n\n"
                            + content[-TOOL_TRUNC_TAIL:]
                        )
                        truncated_indices.append(i)
                    if estimate_messages_tokens(llm_messages) <= threshold:
                        break
                if truncated_indices:
                    est_after = estimate_messages_tokens(llm_messages)
                    _log(
                        f"PECAgent {phase} runtime_budget_guard | loop={loop_i+1} "
                        f"| before={est_before} | after={est_after} "
                        f"| truncated_indices={truncated_indices}"
                    )

        return collected_all_text

    # ── Memory helpers ────────────────────────────────────

    @staticmethod
    def _is_substantive_user_text(text: str) -> bool:
        t = (text or "").strip()
        if len(t) < 4:
            return False
        # Filter out purely numeric/menu-like short replies such as "1", "11", "继续1"
        if t.isdigit():
            return False
        if len(t) <= 6 and all(ch.isdigit() or ch in {" ", ",", ".", "，", "。"} for ch in t):
            return False
        return True

    def _build_recall_query(self, chat_messages: list[dict[str, Any]]) -> str:
        """Build a richer memory/RAG recall query from recent substantive user turns."""
        user_msgs = [
            (m.get("content", "") or "").strip()
            for m in chat_messages
            if m.get("role") == "user"
        ]
        substantive = [m for m in user_msgs if self._is_substantive_user_text(m)]
        chosen = substantive[-3:] if substantive else user_msgs[-1:]
        return "；".join([m for m in chosen if m]).strip()

    @staticmethod
    def _compact_text(text: str, max_chars: int = 1200) -> str:
        t = (text or "").strip()
        if len(t) <= max_chars:
            return t
        return t[:max_chars] + "\n[...短期记忆已截断]"

    def _build_short_term_memory(
        self,
        execute_results: list[str],
        check_summaries: list[str],
        check_feedback: list[str],
    ) -> str | None:
        """Build rolling short-term memory for planning."""
        parts: list[str] = []
        if execute_results:
            exec_mem = "\n\n".join(self._compact_text(x, 1000) for x in execute_results[-2:] if x)
            if exec_mem:
                parts.append("### 近期执行结果\n" + exec_mem)
        if check_summaries:
            check_mem = "\n".join(check_summaries[-3:])
            if check_mem:
                parts.append("### 近期审查结论\n" + check_mem)
        if check_feedback:
            parts.append("### 当前待补缺口\n" + "\n".join(f"- {g}" for g in check_feedback))
        if not parts:
            return None
        return "## 短期记忆（本次会话内）\n" + "\n\n".join(parts)

    def _recall_memory(self, user_question: str) -> tuple[str | None, int]:
        """Auto-recall relevant memories for the current query.

        Returns:
            (memory_text_or_None, elapsed_ms): retrieved memory and call latency.
            elapsed_ms is 0 when skipped (no MEMORY_USER_ID).
        """
        user_id = os.environ.get("MEMORY_USER_ID", "")
        if not user_id:
            return None, 0
        t0 = time.perf_counter()
        try:
            from base.tools.builtin.memory_tools import memory_recall
            result = memory_recall(query=user_question, top_k=5)
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            if result and result != "[]":
                _log(f"PECAgent memory recall returned {len(result)} chars in {elapsed_ms}ms")
                return result, elapsed_ms
            return None, elapsed_ms
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            _log(f"PECAgent memory recall error: {e}")
            return None, elapsed_ms

    def _pre_search_rag(self, user_question: str) -> tuple[str | None, int]:
        """Pre-search RAG knowledge base so Plan knows what data already exists.

        Returns:
            (rag_text_or_None, elapsed_ms): retrieved chunks and call latency.
        """
        t0 = time.perf_counter()
        try:
            from base.tools.builtin.rag_tools import rag_search
            result = rag_search(query=user_question, top_k=3)
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            if result and result != "[]":
                _log(f"PECAgent RAG pre-search returned {len(result)} chars in {elapsed_ms}ms")
                return result, elapsed_ms
            return None, elapsed_ms
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            _log(f"PECAgent RAG pre-search error: {e}")
            return None, elapsed_ms

    # ── Context helpers ─────────────────────────────────────

    def _build_ctx(
        self, system_prompt: str, chat_messages: list[dict[str, Any]],
        *, memory_context: str | None = None,
        rag_context: str | None = None,
    ) -> ContextBuilder:
        ctx = ContextBuilder()
        ctx.set_system(system_prompt)
        ctx.add_messages(chat_messages)
        if memory_context:
            ctx.inject_memory(memory_context)
        if rag_context:
            ctx.inject_rag_context(rag_context)
        return ctx

    # ── Main PEC loop ───────────────────────────────────────

    def execute(self, request: AgentRequest) -> Generator[BaseAgent.AgentOutput, None, None]:
        if not request.messages:
            yield AgentError(content="No messages provided")
            return

        session_id = request.session_id or "unknown"
        flog = _LLMFileLogger("PECAgent", str(session_id))
        session_t0 = time.perf_counter()
        session_wall_t0 = time.time()
        _log(f"PECAgent start | log={flog._path.name}")

        try:
            self._get_llm()
        except ValueError as e:
            yield AgentError(content=str(e), code="CONFIG_ERROR")
            return

        user_question = request.messages[-1].get("content", "") if request.messages else ""
        chat_messages = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in request.messages]
        recall_query = self._build_recall_query(chat_messages) or user_question

        canvas_nodes = request.params.get("canvas_nodes", [])
        if canvas_nodes:
            init_dedup_from_canvas(canvas_nodes)
            self._canvas_history = [
                {
                    "label": n.get("label", ""),
                    **({"tickers": n["tickers"]} if n.get("tickers") else {}),
                }
                for n in canvas_nodes
            ]
            _log(f"PECAgent loaded {len(canvas_nodes)} canvas nodes from DB")
        else:
            self._canvas_history = []

        all_execute_results: list[str] = []
        check_feedback: list[str] = []
        all_check_summaries: list[str] = []

        memory_context, memory_elapsed_ms = self._recall_memory(recall_query)
        if memory_elapsed_ms > 0:
            yield Timing(
                phase="memory_recall",
                round=0,
                elapsed_ms=memory_elapsed_ms,
                metadata={"hit": memory_context is not None},
            )

        rag_context, rag_elapsed_ms = self._pre_search_rag(recall_query)
        yield Timing(
            phase="rag_search",
            round=0,
            elapsed_ms=rag_elapsed_ms,
            metadata={"hit": rag_context is not None},
        )

        try:
            for round_i in range(1, MAX_PEC_ROUNDS + 1):
                _log(f"PECAgent === PEC round {round_i}/{MAX_PEC_ROUNDS} ===")

                # ── PLAN ──
                yield PhaseStart(phase="plan", round=round_i)
                t_plan = time.perf_counter()

                short_term_memory = self._build_short_term_memory(
                    all_execute_results,
                    all_check_summaries,
                    check_feedback,
                )
                plan_memory_context = memory_context
                if short_term_memory:
                    plan_memory_context = (
                        f"{memory_context}\n\n{short_term_memory}" if memory_context else short_term_memory
                    )

                plan_ctx = self._build_ctx(
                    build_plan_prompt(), chat_messages,
                    memory_context=plan_memory_context, rag_context=rag_context,
                )
                plan_data, plan_llm_ms = self._call_llm_json(
                    build_plan_prompt(), plan_ctx.build()[1:], flog, "plan", round_i,
                )
                yield Timing(
                    phase="llm_call",
                    round=round_i,
                    elapsed_ms=plan_llm_ms,
                    metadata={"phase_owner": "plan", "stream": False},
                )
                steps = plan_data.get("steps", [])

                yield AgentPlan(steps=steps, reasoning=plan_data.get("reasoning", ""))
                yield Timing(
                    phase="plan",
                    round=round_i,
                    elapsed_ms=int((time.perf_counter() - t_plan) * 1000),
                    metadata={"steps": len(steps)},
                )
                yield PhaseEnd(phase="plan", round=round_i)

                if not steps:
                    _log("PECAgent no steps planned — direct answer mode")
                    yield PhaseStart(phase="synthesize", round=round_i)
                    t_synth = time.perf_counter()
                    synth_ctx = self._build_ctx(
                        build_synthesize_prompt(), chat_messages,
                        memory_context=memory_context,
                    )
                    synth_ctx.inject_environment(canvas_history=self._canvas_history)
                    synth_text = yield from self._run_tool_loop(
                        build_synthesize_prompt(),
                        synth_ctx.build()[1:],
                        self._synth_registry, flog, "synthesize", round_i,
                    )
                    yield Timing(
                        phase="synthesize",
                        round=round_i,
                        elapsed_ms=int((time.perf_counter() - t_synth) * 1000),
                        metadata={"path": "no_steps"},
                    )
                    total_ms = int((time.perf_counter() - session_t0) * 1000)
                    yield Timing(
                        phase="total",
                        round=round_i,
                        elapsed_ms=total_ms,
                        metadata={"path": "no_steps", "session_id": session_id},
                    )
                    flog.log_finish("completed_no_steps", round_i, time.time() - session_wall_t0)
                    yield AgentResult(content=synth_text)
                    yield PhaseEnd(phase="synthesize", round=round_i)
                    return

                # ── EXECUTE ──
                yield PhaseStart(phase="execute", round=round_i)
                t_exec = time.perf_counter()

                steps_description = "\n".join(f"{s['id']}. {s['description']}" for s in steps)
                exec_ctx = self._build_ctx(build_execute_prompt(), chat_messages)
                exec_ctx.inject_environment(canvas_history=self._canvas_history)
                phase_parts = [f"请按以下计划执行工具调用获取数据：\n\n{steps_description}"]
                if all_execute_results:
                    phase_parts.append(f"前序已获取的数据摘要：\n{''.join(all_execute_results[-3:])}")
                exec_ctx.inject_phase_context(*phase_parts)

                exec_text = yield from self._run_tool_loop(
                    build_execute_prompt(),
                    exec_ctx.build()[1:],
                    self._exec_registry, flog, "execute", round_i,
                )
                all_execute_results.append(exec_text)

                yield Timing(
                    phase="execute",
                    round=round_i,
                    elapsed_ms=int((time.perf_counter() - t_exec) * 1000),
                )
                yield PhaseEnd(phase="execute", round=round_i)

                # ── CHECK ──
                yield PhaseStart(phase="check", round=round_i)
                t_check = time.perf_counter()

                check_ctx = self._build_ctx(build_check_prompt(), chat_messages)
                check_ctx.inject_phase_context(
                    f"用户原始请求：{user_question}",
                    f"执行结果：\n{exec_text}",
                )
                check_data, check_llm_ms = self._call_llm_json(
                    build_check_prompt(), check_ctx.build()[1:], flog, "check", round_i,
                )
                yield Timing(
                    phase="llm_call",
                    round=round_i,
                    elapsed_ms=check_llm_ms,
                    metadata={"phase_owner": "check", "stream": False},
                )
                passed = check_data.get("passed", True)
                gaps = check_data.get("gaps", [])
                check_summary = str(check_data.get("summary", "") or "").strip()
                summary_parts = [f"第{round_i}轮: {'通过' if passed else '未通过'}"]
                if check_summary:
                    summary_parts.append(check_summary)
                if gaps:
                    summary_parts.append("缺失项: " + "; ".join(str(g) for g in gaps))
                all_check_summaries.append(" | ".join(summary_parts))

                yield AgentCheck(passed=passed, summary=check_data.get("summary", ""), gaps=gaps)
                yield Timing(
                    phase="check",
                    round=round_i,
                    elapsed_ms=int((time.perf_counter() - t_check) * 1000),
                    metadata={"passed": bool(passed)},
                )
                yield PhaseEnd(phase="check", round=round_i)

                if passed:
                    _log(f"PECAgent check passed at round {round_i}")
                    break

                _log(f"PECAgent check failed — gaps: {gaps}")
                check_feedback = gaps

            # ── SYNTHESIZE ──
            yield PhaseStart(phase="synthesize", round=round_i)
            t_synth = time.perf_counter()

            synth_ctx = self._build_ctx(
                build_synthesize_prompt(), chat_messages,
                memory_context=memory_context,
            )
            synth_ctx.inject_environment(canvas_history=self._canvas_history)
            synth_ctx.inject_phase_context(
                f"以下是收集到的所有数据，请据此回复用户：\n\n{''.join(all_execute_results)}"
            )

            synth_text = yield from self._run_tool_loop(
                build_synthesize_prompt(),
                synth_ctx.build()[1:],
                self._synth_registry, flog, "synthesize", round_i,
            )

            yield Timing(
                phase="synthesize",
                round=round_i,
                elapsed_ms=int((time.perf_counter() - t_synth) * 1000),
            )
            total_ms = int((time.perf_counter() - session_t0) * 1000)
            yield Timing(
                phase="total",
                round=round_i,
                elapsed_ms=total_ms,
                metadata={"session_id": session_id, "rounds": round_i},
            )
            flog.log_finish("completed", round_i, time.time() - session_wall_t0)
            yield AgentResult(content=synth_text)
            yield PhaseEnd(phase="synthesize", round=round_i)

        except Exception as e:
            _log(f"PECAgent fatal error: {e}")
            flog.log_error(f"Fatal: {e}")
            yield AgentError(content=f"Agent error: {e}", code="PEC_ERROR")
        finally:
            flog.close()
