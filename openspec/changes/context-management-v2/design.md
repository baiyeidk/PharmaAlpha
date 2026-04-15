## Context

ContextBuilder v1 解决了基本的上下文分层组装问题，但在压力场景下（长对话、多工具调用、跨会话）暴露出多个工程级缺陷。本次 v2 改造覆盖从前端到 Agent 核心层的完整数据通路。

当前架构关键约束：
- Agent 以独立 Python 进程运行，通过 JSON Lines 协议通信，不持有会话状态
- 对话历史已持久化在 PostgreSQL Message 表中（Prisma），但未被 Agent 端利用
- DeepSeek 模型上下文窗口 64K tokens
- 不引入 tiktoken 等 tokenizer 依赖

## Goals / Non-Goals

**Goals:**
- 消除 tool loop 内部上下文溢出风险（P0）
- 预算计算从纯字符改为更接近 token 的估算值（P1）
- 前端不再全量发送历史消息，改用 server-load（P1）
- 截断操作可观测，方便调试（P2）
- 消息类型标签化，消除脆弱的前缀字符串匹配（P2）
- 跨会话实体记忆持久化（P3）
- 长对话自动摘要压缩（P3）

**Non-Goals:**
- 不引入 tiktoken / sentencepiece 等外部 tokenizer
- 不做向量检索（Vector Store）级别的记忆系统
- 不做用户画像系统（仅做实体记忆）
- 不改变 PEC 四阶段架构本身

## Decisions

### Decision 1: Token 估算 — 字符 × 语言系数

**选择**: 逐字符扫描，ASCII 字符计 0.3 token，非 ASCII 字符计 1.5 token。

**替代方案**:
- A) 引入 tiktoken：精确但增加 ~50MB 依赖和 200ms 启动时间
- B) 固定系数（如所有字符 ×1）：太粗糙

**理由**: 我们的内容混合中英文 + JSON 工具结果。逐字符分类的误差在 ±20% 以内，对于 64K 上下文窗口配合保守的 40K 估算上限来说足够安全，且零依赖。

### Decision 2: Server-Load 历史 — route.ts 从 DB 加载

**选择**: `route.ts` 接收 `{ conversationId, newMessage }` 格式，从 Prisma Message 表加载历史，拼装后传给 Agent 进程。

**替代方案**:
- A) Agent 进程自己连数据库加载：违反架构原则（Agent 应该是无状态纯函数）
- B) 前端裁剪（只发最近 N 条）：简单但丢失历史，Agent 无法感知完整对话

**理由**: 数据已经在 DB 中（route.ts 已经在写入），加载成本极低。API 层做裁剪/摘要可以统一控制，Agent 进程接口不变。前端也简化了。

### Decision 3: Tool Loop 运行时守卫 — 循环内截断

**选择**: `_run_tool_loop` 每次工具执行后，估算 `llm_messages` 总 token 量。如果超过 budget 的 80%（预留 20% 给 LLM 回复），对最早的 tool result 消息做截断（保留首尾各 500 字符 + "[...已截断]"）。

**理由**: 工具结果通常头部有关键数据、尾部有总结。首尾保留比直接丢弃更保留信息。80% 阈值给 LLM 回复留余量。

### Decision 4: 消息标签化 — metadata 字段

**选择**: 在消息 dict 中增加 `_tag` 字段（如 `"tool_result"`, `"phase_inject"`, `"env_context"`），ContextBuilder 截断时用 `_tag` 判断消息类型而非前缀匹配。`_tag` 在发送给 LLM 前被 strip 掉。

**替代方案**: 用独立的 metadata dict 或 wrapper 对象。

**理由**: 最小改动。`_tag` 以下划线开头表示是内部字段，`build()` 末尾做一次 strip 即可。

### Decision 5: 跨会话记忆 — Prisma SessionMemory 模型

**选择**: 新增 `SessionMemory` 模型，字段 `{ userId, category, key, value, updatedAt }`。category 分为 `entity`（关注的股票/公司）和 `conclusion`（关键分析结论）。Agent 在 Synthesize 阶段结束后，通过 API 写入记忆；新会话开始时，route.ts 加载用户记忆注入为环境上下文。

**替代方案**:
- A) 用 JSON 文件存储记忆：不适合多用户并发
- B) 复用 Message.metadata：语义不清，查询不方便

**理由**: 结构化存储方便查询和管理。`category + key` 组合唯一，upsert 天然支持更新。

### Decision 6: 自动摘要压缩 — 阈值触发 + LLM 摘要

**选择**: 当 `chat_messages` 估算 token 超过 budget 的 50% 时，对最早的 N 条消息（保留最近 4 条原文）用 LLM 生成摘要（500 字以内），替换原消息为单条 `{ role: "system", content: "[对话摘要] ..." }`。

**触发点**: 在 `route.ts` 加载历史后、传给 Agent 前执行（集中控制，Agent 无感知）。

**理由**: 摘要在 API 层做而不是 Agent 内部做，可以缓存摘要结果避免重复调用 LLM。50% 阈值确保摘要 + 当前对话不会超出上下文窗口。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|------|------|------|
| 字符系数估算误差较大 | 偶尔可能高估或低估 20% token | 使用保守上限（40K est. tokens for 64K window），留 60% 裕度 |
| 自动摘要引入额外 LLM 调用 | 增加延迟 1-3s 和 API 成本 | 仅在超过阈值时触发；摘要结果可持久化到 Message 表避免重复生成 |
| SessionMemory 写入时机 | Synthesize 阶段后 Agent 进程可能已退出 | 由 route.ts 的 flush 阶段通过解析 agent 输出来执行写入，不依赖 Agent 进程 |
| Server-load 模式下旧前端兼容 | 前端改为不发全量历史，老版本不兼容 | route.ts 做兼容：如果收到 messages 数组则用之，如果只有 conversationId + newMessage 则走 server-load |
| _tag strip 遗漏 | 如果 _tag 泄露到 LLM，可能干扰输出 | build() 末尾统一清理，加单元测试断言 |

## Open Questions

- 自动摘要的 LLM 调用是否需要用和主 Agent 不同的（更便宜的）模型？
- SessionMemory 的 entity 记忆上限设多少条合适？（暂定 50 条/用户）
