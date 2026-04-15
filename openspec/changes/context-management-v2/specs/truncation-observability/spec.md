## ADDED Requirements

### Requirement: ContextBuilder 截断日志
ContextBuilder 在执行截断操作时 SHALL 通过 Python `logging` 模块记录以下信息：
- 截断类型（tool_result_truncated / message_removed / budget_enforced）
- 被截断/移除的消息摘要（role、前 50 字符）
- 截断前后的 token 估算值

#### Scenario: 工具结果截断日志
- **WHEN** 一条 tool result 内容被截断（>2000 字符）
- **THEN** 日志记录 `tool_result_truncated`、原始长度、截断后长度

#### Scenario: 消息移除日志
- **WHEN** 预算守卫移除了一条旧消息
- **THEN** 日志记录 `message_removed`、该消息 role 和内容前 50 字符

#### Scenario: 预算执行总结日志
- **WHEN** `build()` 执行完预算守卫
- **THEN** 日志记录 `budget_enforced`、消息总数、token 估算总值、是否触发了截断

### Requirement: Tool loop 截断日志
`_run_tool_loop` 的运行时预算检查在执行截断时 SHALL 记录日志，包含当前 loop 轮次、截断前后 token 估算值、被截断的 tool result 索引。

#### Scenario: 运行时截断日志
- **WHEN** tool loop 第 4 轮触发运行时截断
- **THEN** 日志记录 loop=4、truncated_before=35000、truncated_after=28000、affected_indices=[1,2]
