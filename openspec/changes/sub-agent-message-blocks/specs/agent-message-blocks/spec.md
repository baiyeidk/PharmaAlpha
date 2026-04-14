## ADDED Requirements

### Requirement: 协议层支持标识消息来源的 agent_chunk 事件
系统 SHALL 在 Python 协议层新增 `AgentAgentChunk` 数据类，type 为 `"agent_chunk"`，携带 `agent_name` 和 `content` 字段。Supervisor 在转发子 Agent 的 `chunk` 输出时 SHALL 使用此事件替代直接转发原始 `chunk`。

#### Scenario: 子 Agent 输出被包装为 agent_chunk
- **WHEN** Supervisor 委派 stock_analyst 执行任务，stock_analyst yield 一个 `AgentChunk(content="正在查询行情...")`
- **THEN** Supervisor SHALL emit `{"type": "agent_chunk", "agent_name": "stock_analyst", "content": "正在查询行情..."}` 而非 `{"type": "chunk", "content": "正在查询行情..."}`

#### Scenario: 子 Agent 的 tool_start/tool_result 事件附带来源标识
- **WHEN** 子 Agent 执行工具产生 `tool_start` 或 `tool_result` 事件
- **THEN** Supervisor SHALL 在转发时附加 `agent_name` 字段到事件 JSON 中

#### Scenario: Supervisor 自身的 chunk 不携带 agent_name
- **WHEN** Supervisor LLM 生成自己的流式文本（规划/总结）
- **THEN** 输出 SHALL 使用原始 `chunk` 类型，不包含 `agent_name` 字段

### Requirement: 前端按 agent 来源分块渲染消息
前端 SHALL 将一条助手消息渲染为多个可视"块"（blocks）。每个 block 代表一个执行阶段，包含来源标识、内容和状态。

#### Scenario: 多子 Agent 响应分块显示
- **WHEN** Supervisor 先委派 pharma_analyst 再委派 stock_analyst
- **THEN** 用户 SHALL 看到至少 3 个 block：Supervisor 规划 block、pharma_analyst 执行 block、stock_analyst 执行 block，每个 block 有独立的标题和内容区域

#### Scenario: 子 Agent block 显示名称和任务
- **WHEN** 前端收到 `agent_delegate` 事件（agent_name="stock_analyst", task="查询600276行情"）
- **THEN** 对应 block SHALL 显示 agent 显示名称和任务描述作为标题

#### Scenario: 子 Agent block 内容流式更新
- **WHEN** 前端连续收到同一 agent_name 的多个 `agent_chunk` 事件
- **THEN** 内容 SHALL 流式追加到对应 block 的内容区域，不影响其他 block

#### Scenario: 子 Agent block 完成状态
- **WHEN** 前端收到 `agent_result` 事件
- **THEN** 对应 block 的状态 SHALL 从 "streaming" 变为 "done"，流式指示器消失

### Requirement: 工具调用状态在对应 block 内可见
前端 SHALL 在对应的 agent block 内显示工具调用的开始和结果。

#### Scenario: 工具开始事件显示
- **WHEN** 前端收到带有 `agent_name` 的 `tool_start` 事件
- **THEN** 对应 block SHALL 内联显示工具调用指示（工具名称 + 参数摘要）

#### Scenario: 工具结果事件显示
- **WHEN** 前端收到带有 `agent_name` 的 `tool_result` 事件
- **THEN** 对应 block SHALL 更新工具调用状态为成功/失败

### Requirement: 向后兼容非 Supervisor agent
对于不使用多 Agent 协作的旧 agent（如 pharma_agent），前端 SHALL 保持现有的单文本渲染行为。

#### Scenario: 旧 agent 无 block 渲染
- **WHEN** pharma_agent 只发送普通 `chunk` 和 `result` 事件（无 `agent_delegate`/`agent_chunk`）
- **THEN** 消息 SHALL 以当前的单文本气泡形式渲染，无 block 分割

### Requirement: 子 Agent block 可折叠
每个子 Agent block SHALL 支持展开/折叠操作，默认展开。完成后的 block 用户可手动折叠以节省空间。

#### Scenario: 用户折叠已完成的 block
- **WHEN** 用户点击已完成 block 的折叠按钮
- **THEN** block 内容区域 SHALL 收起，仅保留标题行（agent 名称 + 状态标记）
