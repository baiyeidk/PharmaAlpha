## ADDED Requirements

### Requirement: 基于字符语言分类的 token 估算
系统 SHALL 提供 `estimate_tokens(text: str) -> int` 函数，遍历字符并按语言分类计算估算 token 数：ASCII 字符（ord < 128）计 0.3 token，非 ASCII 字符计 1.5 token。结果向上取整返回整数。

#### Scenario: 纯英文文本估算
- **WHEN** 输入 "Hello World"（11 ASCII 字符）
- **THEN** 返回 ceil(11 × 0.3) = 4

#### Scenario: 纯中文文本估算
- **WHEN** 输入 "你好世界"（4 非 ASCII 字符）
- **THEN** 返回 ceil(4 × 1.5) = 6

#### Scenario: 中英混合文本估算
- **WHEN** 输入 "分析 AAPL 股票"（包含 5 个 ASCII 字符和 5 个非 ASCII 字符）
- **THEN** 返回 ceil(5 × 0.3 + 5 × 1.5) = ceil(9.0) = 9

### Requirement: 消息列表 token 估算
系统 SHALL 提供 `estimate_messages_tokens(messages: list[dict]) -> int` 函数，对 messages 中每条消息的 `content` 字段调用 `estimate_tokens()`，加上每条消息的固定开销 4 token（role/separator），返回总和。

#### Scenario: 多消息列表估算
- **WHEN** 输入包含 3 条消息，内容分别为 100 个 ASCII 字符
- **THEN** 返回 3 × (ceil(100 × 0.3) + 4) = 3 × 34 = 102

### Requirement: ContextBuilder 集成
ContextBuilder SHALL 使用 `estimate_messages_tokens()` 替代原有的字符计数作为预算守卫的判断依据。`max_chars` 参数改名为 `max_tokens`，默认值 40000。

#### Scenario: 预算守卫使用 token 估算
- **WHEN** ContextBuilder 以 max_tokens=40000 构建消息列表
- **THEN** `_apply_budget()` 内部使用 `estimate_messages_tokens()` 计算总量
- **THEN** 截断/移除决策基于 token 估算值而非字符数
