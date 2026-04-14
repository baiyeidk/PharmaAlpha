## ADDED Requirements

### Requirement: 删除 route.ts 中的 toolCallPattern 正则
`src/app/api/chat/route.ts` SHALL 移除 `toolCallPattern` 正则常量及 `captureAndForward.transform` 中对 `chunk.content` 的正则匹配逻辑。

#### Scenario: route.ts 不包含 tool_call 正则
- **WHEN** 审查 `src/app/api/chat/route.ts` 源码
- **THEN** 不存在 `toolCallPattern` 变量定义，不存在对 `chunk.content` 的 `matchAll(toolCallPattern)` 调用

### Requirement: 协议层 tool_call 事件继续被正确处理
`route.ts` SHALL 继续拦截 `type === "tool_call"` 且 `name` 以 `canvas.` 开头的协议事件，调用 `executeCanvasTool` 执行。

#### Scenario: 独立 tool_call 事件被正确执行
- **WHEN** executor stream 传递一个 `{ type: "tool_call", name: "canvas.add_node", args: {...} }` 事件
- **THEN** `captureAndForward` 识别并调用 `executeCanvasTool`，将结果转发给前端

### Requirement: route.ts 透传 PEC 阶段事件
`route.ts` 的 `passthroughTypes` 集合 SHALL 包含 `"phase_start"` 和 `"phase_end"`。

#### Scenario: phase_start 事件被透传
- **WHEN** Agent 输出 `{ type: "phase_start", phase: "plan", round: 1 }` 事件
- **THEN** `captureAndForward` 将事件原样透传给前端 SSE 流
