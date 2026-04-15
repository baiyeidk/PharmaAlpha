## ADDED Requirements

### Requirement: ContextBuilder 统一组装各阶段 LLM 消息
ContextBuilder SHALL 提供声明式 API，按优先级组装 system prompt、对话历史、阶段注入内容和环境上下文为 LLM messages 列表。

#### Scenario: Plan 阶段上下文组装
- **WHEN** PEC Agent 进入 Plan 阶段
- **THEN** ContextBuilder 组装 [system=plan_prompt, ...chat_messages, ?check_feedback]，不包含任何旧式 canvas 文本指令

#### Scenario: Execute 阶段上下文组装
- **WHEN** PEC Agent 进入 Execute 阶段
- **THEN** ContextBuilder 组装 [system=exec_prompt, ...chat_messages, plan_steps, ?prev_results]

#### Scenario: Check 阶段包含对话历史
- **WHEN** PEC Agent 进入 Check 阶段
- **THEN** ContextBuilder 组装 [system=check_prompt, ...chat_messages, user_question, exec_results]，MUST 包含完整对话历史而非仅最后一条消息

#### Scenario: Synthesize 阶段注入环境上下文
- **WHEN** PEC Agent 进入 Synthesize 阶段
- **THEN** ContextBuilder 组装 [system=synth_prompt, ...chat_messages, all_exec_results, environment_context]，环境上下文包含画布已有内容

### Requirement: Token 预算守卫防止上下文溢出
ContextBuilder SHALL 对组装后的消息总量实施字符数软限制，超限时按优先级截断。

#### Scenario: 工具返回结果超长
- **WHEN** 单个工具返回结果超过 2000 字符
- **THEN** ContextBuilder MUST 将该结果截断到 2000 字符并追加 "[...已截断]" 标记

#### Scenario: 总上下文超过预算
- **WHEN** 组装后的消息总字符数超过 max_chars（默认 60000）
- **THEN** ContextBuilder MUST 从最早的对话消息开始移除，直到总量低于预算，但 MUST 保留最近 2 条用户消息和 system prompt

#### Scenario: System prompt 永不截断
- **WHEN** 执行截断策略
- **THEN** system prompt 和当前阶段注入内容 MUST 不被截断

### Requirement: 环境上下文结构化注入
ContextBuilder SHALL 支持注入环境信息块，以 system 或 user 消息的形式添加到上下文中。

#### Scenario: 注入画布已有内容
- **WHEN** canvas_history 非空
- **THEN** ContextBuilder MUST 在消息末尾追加一条描述画布已有节点的消息，包含节点类型、标题和关键参数

#### Scenario: 注入当前时间
- **WHEN** ContextBuilder 构建上下文
- **THEN** MUST 在 system prompt 后追加当前日期时间信息，格式为 "当前时间: YYYY-MM-DD HH:MM"

#### Scenario: 无环境信息时不注入
- **WHEN** 没有 canvas_history 且无其他环境信息
- **THEN** ContextBuilder MUST 不添加额外的环境消息
