## Why

PEC Agent 的上下文管理存在系统性问题：route.ts 注入的旧式 canvas 文本指令与 PEC Agent 的原生 function calling 冲突，导致 LLM 时而输出 raw JSON 而非走 tool_calls；四个 PEC 阶段各自手动拼装 messages 没有统一管理，CHECK 阶段丢失对话历史；无任何 token 预算控制，长对话或大量工具返回数据会超出上下文窗口。需要建立统一的上下文管理层，消除冲突、规范组装、防止溢出。

## What Changes

- **移除 route.ts 中的旧式 canvas system message 注入** — `getCanvasSystemMessage()` 和 `tools` 参数传递对 PEC Agent 无用且有害，清理掉
- **新建 ContextBuilder 模块** — 统一管理各 PEC 阶段的消息组装，提供 token 预算守卫和智能截断
- **环境上下文注入** — 将画布已有内容、当前时间等环境信息结构化注入 agent 上下文，替代当前仅在 synthesize prompt 末尾拼接的临时做法
- **CHECK 阶段上下文修复** — 恢复对话历史传入，避免多轮追问场景下审查员丢失语境
- **Token 预算与截断策略** — 对工具返回结果和历史消息实施基于字符数的软限制，防止超窗口

## Capabilities

### New Capabilities
- `context-builder`: 统一的上下文组装器，管理 system prompt、对话历史、阶段注入内容、环境上下文、token 预算
- `context-cleanup`: 清理 route.ts 与 PEC Agent 之间的上下文传递链路，消除冲突指令

### Modified Capabilities

## Impact

- `src/app/api/chat/route.ts` — 移除 canvas system message 注入和 tools 传递
- `src/lib/agents/tool-definitions.ts` — `getCanvasSystemMessage()` / `buildToolSystemPrompt()` 可能废弃或限定仅供非 PEC agent 使用
- `agents/supervisor_agent/pec_agent.py` — 重构 execute() 中的消息组装逻辑，改用 ContextBuilder
- `agents/supervisor_agent/prompts.py` — 环境上下文注入逻辑从 prompt 函数参数改为 ContextBuilder 统一管理
- `agents/base/` — 新增 `context_builder.py` 模块
