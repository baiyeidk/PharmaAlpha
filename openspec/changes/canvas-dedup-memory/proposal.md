## Why

PEC Agent 的 Execute 阶段和 Synthesize 阶段都可以调用 `canvas_add_chart` / `canvas_add_text`。LLM 在两个阶段中缺乏对已创建 Canvas 节点的记忆，导致同一只股票的走势图被重复添加。需要在 PEC 循环中维护 Canvas 操作历史，并在后续阶段的 prompt 中注入这些信息，防止 LLM 重复创建。

## What Changes

- 在 `PECAgent` 中新增 Canvas 操作记忆（`_canvas_history` 列表），记录每次成功的 canvas 工具调用
- 在 `_run_tool_loop` 中拦截 canvas 工具的 `tool_result`，将成功调用记录到 `_canvas_history`
- Synthesize 阶段的 prompt 中动态注入已有 Canvas 节点列表，明确告知 LLM "以下内容已添加到画布，不要重复"
- 可选：在 `canvas_tools.py` 层面做 ticker 级别的硬去重（同一 ticker 的 chart 只 emit 一次）

## Capabilities

### New Capabilities
- `canvas-dedup`: Canvas 操作去重——PEC 内部循环中追踪已创建的 Canvas 节点，防止跨阶段重复创建

### Modified Capabilities

## Impact

- **Python**: `agents/supervisor_agent/pec_agent.py`（新增 `_canvas_history` 追踪逻辑）、`agents/supervisor_agent/prompts.py`（`build_synthesize_prompt` 接受已有节点参数）
- **可选**: `agents/base/tools/builtin/canvas_tools.py`（工具层硬去重）
- 不影响前端、协议层或 API 层
