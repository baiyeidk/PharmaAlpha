## ADDED Requirements

### Requirement: 对话历史超阈值自动摘要
route.ts 在从数据库加载对话历史后 SHALL 估算总 token 量（使用前端侧的简单估算：中文字符 ×1.5 + ASCII ×0.3）。当估算值超过 budget 的 50%（默认 20000 tokens）时，SHALL 对最早的消息执行摘要压缩。

摘要逻辑：
1. 保留最近 4 条消息原文不动
2. 将剩余的旧消息合并发送给 LLM，prompt 为 "将以下对话摘要为 500 字以内的中文摘要，保留关键数据和结论"
3. 用摘要结果替换旧消息，以 `{ role: "system", content: "[对话历史摘要] ..." }` 形式插入

#### Scenario: 短对话不触发摘要
- **WHEN** 对话历史估算为 10000 tokens（< 50% of 40000）
- **THEN** 不执行摘要，原样传给 Agent

#### Scenario: 长对话触发摘要
- **WHEN** 对话历史估算为 25000 tokens（> 50% of 40000）
- **THEN** 保留最近 4 条消息原文
- **THEN** 其余消息被 LLM 摘要替换为一条 system 消息
- **THEN** 摘要后总 token 估算显著下降

#### Scenario: 摘要缓存
- **WHEN** 同一个 conversation 的摘要已在上一次请求中生成
- **THEN** route.ts SHALL 复用已缓存的摘要（存储在 Message 表中 metadata.isSummary=true），不重新调用 LLM

### Requirement: 摘要 LLM 调用配置
摘要调用 SHALL 使用与主 Agent 相同的 LLM 配置（环境变量 `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`）。可通过 `SUMMARY_MODEL` 环境变量覆盖模型选择（使用更便宜的模型）。

#### Scenario: 使用默认模型
- **WHEN** 未设置 `SUMMARY_MODEL`
- **THEN** 摘要调用使用 `LLM_MODEL` 指定的模型

#### Scenario: 使用独立摘要模型
- **WHEN** 设置 `SUMMARY_MODEL=deepseek-chat`
- **THEN** 摘要调用使用 `deepseek-chat`，主 Agent 不受影响
