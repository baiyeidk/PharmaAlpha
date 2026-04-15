## ADDED Requirements

### Requirement: Tool loop 内部运行时预算检查
`_run_tool_loop` 在每次工具执行完成后 SHALL 估算当前 `llm_messages` 的总 token 量（使用 token-estimation 模块）。当估算值超过 budget 的 80% 时，SHALL 对最早的 tool result 消息执行截断（保留首 500 字符 + 尾 500 字符 + "[...已截断]"），直到总量降到 80% 以下。

#### Scenario: 正常工具调用未超限
- **WHEN** 执行 3 次工具调用，每次返回 1000 字符结果
- **THEN** 所有 tool result 保持原文，不做截断

#### Scenario: 多工具调用超过 80% 预算
- **WHEN** 执行 6 次工具调用，每次返回 5000 字符结果，总估算 token 超过 budget 的 80%
- **THEN** 最早的 tool result 被截断为首500字符 + 尾500字符 + "[...已截断]"
- **THEN** 截断后总估算 token 降到 budget 的 80% 以下

#### Scenario: System prompt 和最近消息不被截断
- **WHEN** 运行时预算检查触发截断
- **THEN** system prompt 消息 SHALL NOT 被截断
- **THEN** 最近一轮的 assistant + tool 消息 SHALL NOT 被截断

### Requirement: 预算上限可配置
PECAgent SHALL 支持通过环境变量 `CONTEXT_BUDGET_TOKENS` 配置 token 预算上限，默认值为 40000。

#### Scenario: 使用默认预算
- **WHEN** 未设置 `CONTEXT_BUDGET_TOKENS` 环境变量
- **THEN** 使用 40000 作为预算上限

#### Scenario: 自定义预算
- **WHEN** 设置 `CONTEXT_BUDGET_TOKENS=30000`
- **THEN** 使用 30000 作为预算上限
