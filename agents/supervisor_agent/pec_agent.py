"""PEC (Plan-Execute-Check) Agent — single-process loop with unified tool pool."""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any, Generator

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.base_agent import BaseAgent
from base.protocol import (
    AgentRequest, AgentChunk, AgentResult, AgentError,
    AgentToolStart, AgentToolResult, AgentPlan, AgentCheck,
    AgentToolCall, PhaseStart, PhaseEnd,
)
from base.tools import ToolRegistry
from base.tools.builtin import (
    register_stock_tools, register_financial_tools,
    register_web_tools, register_pdf_tools,
)
from base.tools.builtin.canvas_tools import (
    canvas_add_chart, canvas_add_text, set_emit_callback,
)
from base.tool_callable_agent import _LLMFileLogger, _log

from supervisor_agent.prompts import (
    build_plan_prompt, build_execute_prompt,
    build_check_prompt, build_synthesize_prompt,
)

MAX_PEC_ROUNDS = 3
MAX_TOOL_LOOPS = 10


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
        self._exec_registry.register(canvas_add_chart)

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

    # ── LLM call helpers ────────────────────────────────────

    def _call_llm_json(
        self, system_prompt: str, messages: list[dict[str, Any]], flog: _LLMFileLogger, phase: str, round_i: int,
    ) -> dict[str, Any]:
        """Non-streaming LLM call that returns parsed JSON."""
        model = self._get_model()
        llm = self._get_llm()

        llm_messages = [{"role": "system", "content": system_prompt}] + messages

        flog.log_request(round_i, model, llm_messages, None)
        _log(f"PECAgent {phase} round={round_i} — calling LLM (json)")
        t0 = time.time()

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
        elapsed = time.time() - t0
        _log(f"PECAgent {phase} done in {elapsed:.1f}s | len={len(content)}")
        flog.log_response(round_i, content, [], elapsed)

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {"error": "Invalid JSON from LLM", "raw": content}

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
            t0 = time.time()

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

            elapsed = time.time() - t0
            _log(f"PECAgent {phase} loop {loop_i+1} done in {elapsed:.1f}s | text={len(collected_content)}ch | tools={len(collected_tool_calls)}")
            flog.log_response(round_i, collected_content, collected_tool_calls, elapsed)

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
                t1 = time.time()
                yield AgentToolStart(name=fn_name, args=fn_args)
                result_str = registry.execute(fn_name, fn_args)
                success = not result_str.startswith("[Tool Error]")
                tool_elapsed = time.time() - t1
                _log(f"PECAgent {phase} tool done: {fn_name} in {tool_elapsed:.1f}s | ok={success}")
                flog.log_tool_exec(round_i, fn_name, fn_args, result_str, success, tool_elapsed)
                yield AgentToolResult(name=fn_name, result=result_str, success=success)

                if success and fn_name.startswith("canvas_"):
                    entry = {"tool": fn_name, "label": fn_args.get("label", "")}
                    if "tickers" in fn_args:
                        entry["tickers"] = fn_args["tickers"]
                    self._canvas_history.append(entry)

                llm_messages.append({"role": "tool", "tool_call_id": tc["id"], "content": result_str})

        return collected_all_text

    # ── Main PEC loop ───────────────────────────────────────

    def execute(self, request: AgentRequest) -> Generator[BaseAgent.AgentOutput, None, None]:
        if not request.messages:
            yield AgentError(content="No messages provided")
            return

        session_id = request.session_id or "unknown"
        flog = _LLMFileLogger("PECAgent", str(session_id))
        session_t0 = time.time()
        _log(f"PECAgent start | log={flog._path.name}")

        try:
            self._get_llm()
        except ValueError as e:
            yield AgentError(content=str(e), code="CONFIG_ERROR")
            return

        user_question = request.messages[-1].get("content", "") if request.messages else ""
        chat_messages = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in request.messages]

        all_execute_results: list[str] = []
        check_feedback: list[str] = []

        try:
            for round_i in range(1, MAX_PEC_ROUNDS + 1):
                _log(f"PECAgent === PEC round {round_i}/{MAX_PEC_ROUNDS} ===")

                # ── PLAN ──
                yield PhaseStart(phase="plan", round=round_i)

                plan_context = list(chat_messages)
                if check_feedback:
                    plan_context.append({
                        "role": "user",
                        "content": f"上一轮审查发现以下缺失，请重新规划补充：\n" + "\n".join(f"- {g}" for g in check_feedback),
                    })

                plan_data = self._call_llm_json(build_plan_prompt(), plan_context, flog, "plan", round_i)
                steps = plan_data.get("steps", [])

                yield AgentPlan(
                    steps=steps,
                    reasoning=plan_data.get("reasoning", ""),
                )
                yield PhaseEnd(phase="plan", round=round_i)

                if not steps:
                    _log("PECAgent no steps planned — direct answer mode")
                    yield PhaseStart(phase="synthesize", round=round_i)
                    synth_text = yield from self._run_tool_loop(
                        build_synthesize_prompt(canvas_history=self._canvas_history),
                        chat_messages,
                        self._synth_registry, flog, "synthesize", round_i,
                    )
                    flog.log_finish("completed_no_steps", round_i, time.time() - session_t0)
                    yield AgentResult(content=synth_text)
                    yield PhaseEnd(phase="synthesize", round=round_i)
                    return

                # ── EXECUTE ──
                yield PhaseStart(phase="execute", round=round_i)

                steps_description = "\n".join(f"{s['id']}. {s['description']}" for s in steps)
                exec_messages = list(chat_messages) + [
                    {"role": "user", "content": f"请按以下计划执行工具调用获取数据：\n\n{steps_description}"},
                ]
                if all_execute_results:
                    exec_messages.append({
                        "role": "user",
                        "content": f"前序已获取的数据摘要：\n{''.join(all_execute_results[-3:])}",
                    })

                exec_text = yield from self._run_tool_loop(
                    build_execute_prompt(),
                    exec_messages,
                    self._exec_registry, flog, "execute", round_i,
                )
                all_execute_results.append(exec_text)

                yield PhaseEnd(phase="execute", round=round_i)

                # ── CHECK ──
                yield PhaseStart(phase="check", round=round_i)

                check_messages = [
                    {"role": "user", "content": f"用户原始请求：{user_question}"},
                    {"role": "user", "content": f"执行结果：\n{exec_text[:4000]}"},
                ]

                check_data = self._call_llm_json(build_check_prompt(), check_messages, flog, "check", round_i)
                passed = check_data.get("passed", True)
                gaps = check_data.get("gaps", [])

                yield AgentCheck(
                    passed=passed,
                    summary=check_data.get("summary", ""),
                    gaps=gaps,
                )
                yield PhaseEnd(phase="check", round=round_i)

                if passed:
                    _log(f"PECAgent check passed at round {round_i}")
                    break

                _log(f"PECAgent check failed — gaps: {gaps}")
                check_feedback = gaps

            # ── SYNTHESIZE ──
            yield PhaseStart(phase="synthesize", round=round_i)

            synth_messages = list(chat_messages) + [
                {"role": "user", "content": f"以下是收集到的所有数据，请合成分析报告：\n\n{''.join(all_execute_results)}"},
            ]

            synth_text = yield from self._run_tool_loop(
                build_synthesize_prompt(canvas_history=self._canvas_history),
                synth_messages,
                self._synth_registry, flog, "synthesize", round_i,
            )

            flog.log_finish("completed", round_i, time.time() - session_t0)
            yield AgentResult(content=synth_text)
            yield PhaseEnd(phase="synthesize", round=round_i)

        except Exception as e:
            _log(f"PECAgent fatal error: {e}")
            flog.log_error(f"Fatal: {e}")
            yield AgentError(content=f"Agent error: {e}", code="PEC_ERROR")
        finally:
            flog.close()
