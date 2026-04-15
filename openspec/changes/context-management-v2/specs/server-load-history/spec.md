## ADDED Requirements

### Requirement: route.ts 支持 server-load 模式
`POST /api/chat` SHALL 接受两种请求格式：
1. **新格式**（server-load）: `{ agentId, conversationId, newMessage: string }`
2. **旧格式**（兼容）: `{ agentId, messages: array, conversationId? }`

当收到新格式时，route.ts SHALL 从数据库加载该 conversation 的历史 Message 记录，按 `createdAt` 排序，拼装为 `messages` 数组后传给 Agent 进程。

#### Scenario: 新格式请求 — 已有会话
- **WHEN** 前端发送 `{ agentId, conversationId: "abc", newMessage: "分析恒瑞医药" }`
- **THEN** route.ts 从 Message 表加载 conversationId="abc" 的所有消息
- **THEN** 追加 newMessage 作为最后一条 user 消息
- **THEN** 拼装后的 messages 传给 Agent 进程

#### Scenario: 新格式请求 — 新会话
- **WHEN** 前端发送 `{ agentId, newMessage: "你好" }`（无 conversationId）
- **THEN** route.ts 创建新 Conversation
- **THEN** messages 仅包含这一条 user 消息

#### Scenario: 旧格式请求 — 向后兼容
- **WHEN** 前端发送 `{ agentId, messages: [...], conversationId? }`
- **THEN** route.ts 使用传入的 messages 数组（行为与当前一致）

### Requirement: 前端改为 server-load 模式
`useChatStream` 的 `sendMessage()` SHALL 改为发送 `{ agentId, conversationId, newMessage }` 格式。不再将完整 `messages[]` 数组序列化发送。

#### Scenario: 有 conversationId 时发送
- **WHEN** 用户在已有会话中发送消息
- **THEN** 请求 body 为 `{ agentId, conversationId, newMessage: "用户输入" }`

#### Scenario: 新会话时发送
- **WHEN** 用户在新会话中发送第一条消息
- **THEN** 请求 body 为 `{ agentId, newMessage: "用户输入" }`

### Requirement: 历史消息加载上限
route.ts 从数据库加载历史消息时 SHALL 限制最多加载最近 50 条消息（按 createdAt DESC 取 50 条后反转为正序），防止极长会话的数据库查询压力。

#### Scenario: 长会话历史裁剪
- **WHEN** 某 conversation 已有 100 条消息
- **THEN** 只加载最近 50 条
- **THEN** 消息按时间正序排列
