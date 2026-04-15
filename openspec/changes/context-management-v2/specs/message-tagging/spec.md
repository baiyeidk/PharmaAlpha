## ADDED Requirements

### Requirement: 消息标签化
ContextBuilder 组装的消息 SHALL 使用 `_tag` 字段标记消息类型，而非依赖内容前缀匹配。支持的 tag 值：
- `"system_prompt"`: 阶段系统提示
- `"env_context"`: 环境上下文（时间、画布历史）
- `"chat_history"`: 用户对话历史
- `"phase_inject"`: 阶段特定注入内容
- `"tool_result"`: 工具执行结果（由 _run_tool_loop 标记）
- `"summary"`: 自动生成的摘要

#### Scenario: 自动标记 system 消息
- **WHEN** 调用 `set_system(prompt)` 后 `build()`
- **THEN** 生成的 system 消息携带 `_tag: "system_prompt"`

#### Scenario: 自动标记环境上下文
- **WHEN** 调用 `inject_environment()` 后 `build()`
- **THEN** 生成的环境消息携带 `_tag: "env_context"`

#### Scenario: 自动标记阶段注入
- **WHEN** 调用 `inject_phase_context()` 后 `build()`
- **THEN** 生成的阶段消息携带 `_tag: "phase_inject"`

### Requirement: _tag 字段在发送给 LLM 前清理
`build()` 返回的消息列表中 SHALL NOT 包含 `_tag` 字段。`_tag` 仅在 ContextBuilder 内部流转用于截断决策，`build()` 的最终输出 MUST strip 掉所有 `_tag` 字段。

#### Scenario: LLM 消息无 _tag
- **WHEN** `build()` 返回消息列表
- **THEN** 每条消息中不存在 `_tag` 键

### Requirement: 截断决策基于 _tag 而非前缀匹配
ContextBuilder 的 `_apply_budget()` SHALL 使用 `_tag` 字段判断哪些消息可以被截断或移除，替代当前的 `msg.get("content", "").startswith(...)` 前缀匹配逻辑。

截断优先级（从高到低）：
1. `_tag: "tool_result"` → 单条截断到 2000 字符
2. `_tag: "chat_history"` → 从最早开始移除
3. `_tag: "phase_inject"` → 保护，不移除
4. `_tag: "env_context"` → 保护，不移除
5. `_tag: "system_prompt"` → 保护，永不截断

#### Scenario: tool_result 被优先截断
- **WHEN** 预算超限且存在 _tag="tool_result" 的长消息
- **THEN** 该消息被截断到 2000 字符
- **THEN** _tag="chat_history" 的消息在 tool_result 截断后仍超限才被移除
