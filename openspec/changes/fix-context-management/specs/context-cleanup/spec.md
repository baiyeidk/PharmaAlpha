## ADDED Requirements

### Requirement: PEC Agent 不接收旧式 canvas 文本指令
route.ts SHALL 对 supervisor_agent 类型的请求不注入 getCanvasSystemMessage() 系统消息。

#### Scenario: supervisor_agent 请求不注入 canvas 系统消息
- **WHEN** 用户选择 supervisor_agent（PEC Agent）发起对话
- **THEN** route.ts MUST 不在 messages 数组前面插入 canvas system message，也不传递 tools 参数

#### Scenario: 其他 agent 保持现有行为
- **WHEN** 用户选择非 supervisor_agent 类型的 agent
- **THEN** route.ts MUST 继续注入 canvas system message 和 tools 参数，行为不变

### Requirement: PEC Agent 忽略外部传入的 tools 字段
PECAgent SHALL 使用自身 ToolRegistry 管理的工具列表，不使用 AgentInput 中传入的 tools 字段。

#### Scenario: AgentInput 包含 tools 字段
- **WHEN** PECAgent 收到带有 tools 字段的 AgentInput
- **THEN** PECAgent MUST 忽略该字段，仅使用 _exec_registry 和 _synth_registry 中注册的工具

### Requirement: route.ts 中 canvas tool_call 事件拦截不依赖注入的系统消息
captureAndForward 对 canvas tool_call 的拦截和执行 SHALL 独立于 canvas system message 是否被注入。

#### Scenario: 无 canvas 系统消息时仍能执行 canvas tool_call
- **WHEN** PEC Agent 通过原生 function calling 发出 canvas.add_node tool_call 事件
- **AND** route.ts 未注入 canvas 系统消息
- **THEN** captureAndForward MUST 仍然拦截并通过 executeCanvasTool 执行该事件
