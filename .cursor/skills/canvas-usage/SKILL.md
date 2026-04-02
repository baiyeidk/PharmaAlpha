---
name: canvas-usage
description: PharmaAlpha canvas tool system architecture. Use when working on agent integration, adding new canvas tools, or debugging tool_call flow between agents and the canvas.
---

# 画布工具系统架构

## 核心设计

画布工具对 agent **零侵入** — 不需要修改任何 agent 代码：

```
任意 Agent (Claude/GPT/自定义)
        │
        │ 收到 system message 中的工具描述
        │ 输出 tool_call JSON
        ▼
 chat route transform 层
        │
        │ 1. 正则提取文本中的 tool_call JSON
        │ 2. 拦截 type=tool_call 的独立行
        │ 3. 执行 executeCanvasTool()
        ▼
   Prisma → PostgreSQL
        │
   SSE → 前端 onStreamEnd → loadFromServer → 画布刷新
```

## 工具注入流程

`src/app/api/chat/route.ts` 在发送给 agent 前自动：
1. **注入 system message** — 描述所有可用工具及调用格式
2. **传入 tools 数组** — OpenAI function calling 兼容的 JSON schema

Agent 不需要知道画布的实现细节，只需按标准格式输出 tool_call。

## 服务端解析（双模式）

transform 层支持两种 tool_call 格式：

**模式 A — 独立 JSON 行**（CLI 协议 agent）：
```json
{"type":"tool_call","name":"canvas.add_node","args":{"type":"chart","label":"恒瑞医药","tickers":["600276"]}}
```

**模式 B — 嵌入文本**（LLM 直出）：
LLM 可能把 tool_call JSON 混在回复文本中，transform 用正则提取并执行，
然后从文本中剥离 JSON，只留纯文本给用户。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/lib/agents/tool-definitions.ts` | 工具 schema + system prompt 生成 |
| `src/lib/agents/canvas-tools.ts` | 工具执行器（Prisma 操作） |
| `src/app/api/chat/route.ts` | 注入 + 拦截 + 执行 |
| `src/app/api/canvas/[conversationId]/actions/route.ts` | 独立 HTTP API（供外部调用） |
| `agents/base/canvas_api.py` | Python HTTP SDK（可选） |

## 添加新工具

1. 在 `tool-definitions.ts` 的 `CANVAS_TOOLS` 数组中添加新工具定义
2. 在 `canvas-tools.ts` 的 `executeCanvasTool` switch 中添加执行逻辑
3. 无需修改任何 agent 代码 — system prompt 自动更新

## HTTP API（供外部系统调用）

`POST /api/canvas/{conversationId}/actions`

```bash
curl -X POST http://localhost:3000/api/canvas/{convId}/actions \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"add_node","type":"chart","label":"恒瑞医药","tickers":["600276"]}'
```

Actions: `add_node`, `remove_node`, `update_node`, `list_nodes`, `clear`
