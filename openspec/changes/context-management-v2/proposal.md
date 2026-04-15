## Why

fix-context-management (v1) 引入了 ContextBuilder 和预算守卫，解决了最基本的上下文组装问题。但实际运行暴露出多个工程级缺陷：`_run_tool_loop` 内部上下文无限增长无任何守卫（P0）、字符与 token 映射不精确导致极端场景超限（P1）、前端每次全量发送历史消息导致 payload 膨胀（P1）、截断操作不可观测（P2）、无跨会话记忆（P3）、无自动摘要压缩（P3）。这些问题在用户开始多轮分析时会直接导致 LLM API 报错或对话质量严重下降。

## What Changes

- **Tool Loop 运行时守卫**：在 `_run_tool_loop` 的每次工具执行后检查上下文总量，超限时对最早的 tool result 做截断
- **Token 估算系数**：ContextBuilder 预算从纯字符计数改为字符×语言估算系数（中文 ×1.5, ASCII ×0.3），使 budget 更贴近真实 token 消耗
- **Server-load 消息加载**：前端改为只发 `conversationId + newMessage`，后端从数据库加载历史消息，消除全量传输
- **截断可观测性**：ContextBuilder 在执行截断时记录日志（截断了哪些消息、截断前后 token 估算值）
- **消息标签化**：用结构化标记（metadata tag）替代前缀匹配来识别工具结果消息，消除脆弱的字符串前缀判断
- **跨会话记忆**：引入持久化记忆层，保存用户关注的股票/概念实体和关键分析结论，在新会话时自动注入
- **自动摘要压缩**：当对话历史超过阈值时，用 LLM 对旧消息生成摘要，替换原文

## Capabilities

### New Capabilities
- `runtime-budget-guard`: Tool loop 内部的运行时上下文预算守卫，防止工具调用过程中上下文溢出
- `token-estimation`: 基于字符×语言系数的 token 估算模块，替代纯字符计数
- `server-load-history`: 后端从数据库加载对话历史，前端只发新消息和会话 ID
- `truncation-observability`: 截断操作的日志记录和可观测性
- `message-tagging`: 消息元数据标签化系统，结构化标记消息类型（工具结果、阶段注入等）
- `session-memory`: 跨会话持久化记忆层，记录用户实体关注和关键结论
- `auto-summarize`: 对话历史自动摘要压缩

### Modified Capabilities

## Impact

- **Python Agent 层**: `context_builder.py`（预算逻辑重写）、`pec_agent.py`（tool loop 守卫、记忆注入、摘要调用）
- **API 层**: `route.ts`（server-load 模式，从 DB 加载历史）
- **前端**: `use-chat-stream.ts`（改为只发 conversationId + newMessage）
- **数据库**: 需要新增 `SessionMemory` 模型存储跨会话实体记忆
- **依赖**: 无新 Python 依赖（不引入 tiktoken），Prisma schema 需要更新
