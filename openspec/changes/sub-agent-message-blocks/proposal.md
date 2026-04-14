## Why

当前 Supervisor Agent 委派子 Agent 执行任务时，所有子 Agent 的流式输出（chunk/result）和 Supervisor 自身的文本被混合追加到同一个消息气泡中，用户无法区分哪段内容来自哪个 Agent。需要将不同 Agent 的输出分块展示，类似 Cursor 的折叠代码块效果——每个 sub-agent 的工作过程是一个独立的可视区块，包含标题（agent 名称+任务）、流式内容、工具调用状态，而 Supervisor 的总结也独立显示。

## What Changes

- Python 协议层新增 `agent_chunk` 事件类型，携带 `agent_name` 字段标识消息来源
- Supervisor 在转发子 Agent 输出时，用 `agent_chunk` 替代直接转发 `chunk`，让前端能区分来源
- 前端 `ChatMessage` 数据结构扩展，支持 "消息块" 列表（blocks），每个 block 有来源标识、内容、状态
- `use-chat-stream` hook 根据 `agent_delegate` / `agent_chunk` / `agent_result` 事件自动创建和追加 block
- `ChatMessage` 组件重构为多 block 渲染，每个 sub-agent block 显示为可折叠的独立卡片（标题+流式内容+工具状态），Supervisor 自身文本为默认 block

## Capabilities

### New Capabilities
- `agent-message-blocks`: 子 Agent 输出分块展示 — 协议层标识消息来源、前端按 agent 分块渲染、工具调用状态内联显示

### Modified Capabilities

## Impact

- `agents/base/protocol.py` — 新增 `AgentAgentChunk` 数据类
- `agents/supervisor_agent/agent.py` — 转发逻辑改为 emit `AgentAgentChunk`
- `src/lib/agents/types.ts` — 扩展 `AgentOutputChunk` 类型
- `src/app/api/chat/route.ts` — 透传新事件
- `src/hooks/use-chat-stream.ts` — 重构消息状态管理，引入 block 概念
- `src/components/chat/chat-message.tsx` — 重构为多 block 渲染
- 新增 `src/components/chat/agent-block.tsx` — sub-agent block 卡片组件
