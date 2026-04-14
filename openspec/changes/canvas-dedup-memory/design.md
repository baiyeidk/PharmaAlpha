## Context

PEC Agent（`pec_agent.py`）有两个 ToolRegistry：`_exec_registry`（含 `canvas_add_chart`）和 `_synth_registry`（含 `canvas_add_chart` + `canvas_add_text`）。Execute 阶段和 Synthesize 阶段都可能调用 `canvas_add_chart`，而 LLM 在 Synthesize 阶段不知道 Execute 已经添加了图表。

## Goals / Non-Goals

**Goals:**
- PEC 循环内跨阶段追踪已创建的 Canvas 节点
- Synthesize prompt 动态注入已有节点信息
- 工具层做 ticker 级硬去重作为安全网

**Non-Goals:**
- 不做跨会话的 Canvas 去重（当前为单次对话）
- 不改变前端 Canvas 组件

## Decisions

### D1: 双层去重

**Prompt 层（软去重）**：在 `build_synthesize_prompt()` 中接受 `canvas_history: list[dict]` 参数，生成"已有 Canvas 节点"提示文本。LLM 看到后自行避免重复。

**工具层（硬去重）**：在 `canvas_tools.py` 中维护模块级 `_added_tickers: set`。`canvas_add_chart` 调用时检查 tickers 是否已存在，如已存在则返回提示而不 emit 事件。同理 `canvas_add_text` 按 label 去重。

**理由**：仅靠 prompt 提示不够可靠（LLM 可能忽略），仅靠硬去重会让 LLM 不知道已有节点。双层确保不遗漏。

### D2: 追踪数据结构

```python
_canvas_history: list[dict] = []
# 每项: {"tool": "canvas_add_chart", "label": "...", "tickers": [...]}
# 或:    {"tool": "canvas_add_text", "label": "...", "content_preview": "..."}
```

在 `_run_tool_loop` 的 `AgentToolResult` yield 之后，检查 fn_name 是否为 canvas 工具，如果成功则追加到 `_canvas_history`。

## Risks / Trade-offs

- **[风险] 硬去重过于激进** → 缓解：只对完全相同的 tickers 去重，不同 tickers 组合允许通过
- **[风险] 模块级 `_added_tickers` 跨请求持久化** → 缓解：PEC Agent 是单次请求进程，进程结束后状态自动清除
