## 1. Token 估算模块

- [x] 1.1 新建 `agents/base/token_estimation.py`，实现 `estimate_tokens(text: str) -> int`（ASCII ×0.3, 非ASCII ×1.5, ceil）
- [x] 1.2 实现 `estimate_messages_tokens(messages: list[dict]) -> int`（遍历每条消息 content + 每条消息固定 4 token 开销）
- [x] 1.3 编写单元测试：纯英文、纯中文、中英混合、空字符串的估算结果验证

## 2. 消息标签化

- [x] 2.1 修改 `ContextBuilder`：`set_system()` 生成消息携带 `_tag: "system_prompt"`
- [x] 2.2 修改 `inject_environment()`：生成消息携带 `_tag: "env_context"`
- [x] 2.3 修改 `add_messages()`：对所有 chat 消息添加 `_tag: "chat_history"`
- [x] 2.4 修改 `inject_phase_context()`：生成消息携带 `_tag: "phase_inject"`
- [x] 2.5 修改 `build()` 末尾：strip 所有消息中的 `_tag` 字段后返回
- [x] 2.6 编写单元测试：验证 build() 输出中不包含 `_tag` 字段

## 3. ContextBuilder 预算重构

- [x] 3.1 将 `_apply_budget()` 的字符计数替换为 `estimate_messages_tokens()`
- [x] 3.2 `max_chars` 参数改名为 `max_tokens`，默认值改为 40000
- [x] 3.3 截断判断改用 `_tag` 字段替代前缀匹配：`_tag="tool_result"` 优先截断，`_tag="chat_history"` 可移除，其余保护
- [x] 3.4 支持通过环境变量 `CONTEXT_BUDGET_TOKENS` 覆盖默认值
- [x] 3.5 更新已有单元测试适配新的 token 估算逻辑

## 4. 截断可观测性

- [x] 4.1 在 `context_builder.py` 顶部配置 Python `logging.getLogger("context_builder")`
- [x] 4.2 `_apply_budget()` 中截断 tool_result 时记录日志：`tool_result_truncated`、原始长度、截断后长度
- [x] 4.3 `_apply_budget()` 中移除消息时记录日志：`message_removed`、role、内容前 50 字符
- [x] 4.4 `build()` 末尾记录总结日志：`budget_enforced`、消息数量、token 估算值、是否触发截断

## 5. Tool Loop 运行时守卫

- [x] 5.1 在 `pec_agent.py` 的 `_run_tool_loop` 中，每次工具执行后调用 `estimate_messages_tokens(llm_messages)`
- [x] 5.2 当估算值 > budget × 0.8 时，遍历 `llm_messages` 中 role="tool" 的消息（从最早开始），截断为首500字符 + 尾500字符 + "[...已截断]"
- [x] 5.3 截断时跳过最近一轮的 tool 消息（保护当前正在处理的上下文）
- [x] 5.4 截断时记录日志：loop 轮次、截断前后 token 值、被截断消息索引
- [x] 5.5 编写单元测试：模拟多轮工具调用后预算检查触发截断（集成在 test_context_builder.py 中）

## 6. Server-Load 历史加载

- [x] 6.1 修改 `route.ts`：解析请求体，识别新格式 `{ agentId, conversationId?, newMessage }` 和旧格式 `{ agentId, messages, conversationId? }`
- [x] 6.2 新格式路径：从 Prisma Message 表加载历史消息（`take: 50, orderBy: createdAt desc`，然后 reverse）
- [x] 6.3 拼装加载的历史 + newMessage 为 messages 数组，传给 Agent
- [x] 6.4 修改 `use-chat-stream.ts` 的 `sendMessage()`：改为发送 `{ agentId, conversationId, newMessage }` 格式
- [x] 6.5 `use-chat-stream.ts` 中移除 `[...messages, userMessage].map(...)` 的全量序列化逻辑
- [x] 6.6 验证旧格式请求仍然兼容（不破坏其他调用方）

## 7. 跨会话记忆

- [x] 7.1 在 `prisma/schema.prisma` 中新增 `SessionMemory` 模型（userId, category, key, value, updatedAt），添加 `@@unique([userId, category, key])` 约束
- [x] 7.2 运行 `npx prisma db push` 同步数据库 + 重新生成 Prisma Client
- [x] 7.3 在 `route.ts` 中新增 `loadSessionMemory(userId)` 函数：查询最近 20 条 SessionMemory，格式化为 system 消息
- [x] 7.4 在 Agent 消息发送前注入记忆 system 消息
- [x] 7.5 在 `captureAndForward` 的 `flush()` 中新增 `extractAndSaveMemory(content, userId)` 函数：正则匹配股票代码+公司名，提取结论段落
- [x] 7.6 实现记忆上限清理：写入前检查该用户记忆数量，超 50 条则删除最早的

## 8. 自动摘要压缩

- [x] 8.1 在 `src/lib/agents/` 下新增 `summarizer.ts`：实现 `summarizeHistory(messages, config)` 函数
- [x] 8.2 实现 token 估算函数（TypeScript 版）：与 Python 侧相同的 ASCII ×0.3 + 非ASCII ×1.5 逻辑
- [x] 8.3 在 `route.ts` 中，加载历史消息后检查 token 估算值。超过 budget 50% 时调用 `summarizeHistory()`
- [x] 8.4 摘要结果替换旧消息为 `{ role: "system", content: "[对话历史摘要] ..." }` 格式
- [x] 8.5 摘要缓存：通过检测已有 "[对话历史摘要]" 前缀的 system 消息来避免重复生成
- [x] 8.6 支持 `SUMMARY_MODEL` 环境变量覆盖摘要模型选择

## 9. 集成验证

- [ ] 9.1 启动开发服务器，选择 supervisor_agent，发送"分析恒瑞医药"，确认功能正常
- [ ] 9.2 连续 5 轮追问，确认 server-load 模式下历史正确加载
- [ ] 9.3 检查 agent 日志，确认 token 估算值和截断日志正常输出
- [ ] 9.4 开启新会话，确认之前分析的股票实体出现在记忆注入中
- [ ] 9.5 模拟长对话（>20000 tokens），确认自动摘要触发且不影响对话质量
