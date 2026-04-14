## ADDED Requirements

### Requirement: 前端按 PEC 阶段分块展示
前端 SHALL 根据 `phase_start` / `phase_end` 事件将 Agent 输出划分为独立的 MessageBlock，每个阶段对应一个可折叠的区块。

#### Scenario: Plan 阶段展示
- **WHEN** 前端收到 `phase_start { phase: "plan" }`
- **THEN** 创建一个新的 MessageBlock，标题显示"规划中"，内容展示 Plan 输出的步骤列表

#### Scenario: Execute 阶段展示
- **WHEN** 前端收到 `phase_start { phase: "execute" }`
- **THEN** 创建一个新的 MessageBlock，标题显示"执行中"，内部展示 tool_start / tool_result 事件的工具调用状态

#### Scenario: Check 阶段展示
- **WHEN** 前端收到 `phase_start { phase: "check" }`
- **THEN** 创建一个新的 MessageBlock，标题显示"审查中"，内容展示 Check 的通过/失败结果及缺失项

#### Scenario: Synthesize 阶段展示
- **WHEN** 前端收到 `phase_start { phase: "synthesize" }`
- **THEN** 流式文本直接追加到主消息区域（不在折叠块内）

### Requirement: 阶段 Block 支持折叠
Plan、Execute、Check 阶段的 MessageBlock SHALL 支持点击折叠/展开。当阶段完成后（收到对应 `phase_end`）SHALL 自动折叠。

#### Scenario: Execute 完成后自动折叠
- **WHEN** 前端收到 `phase_end { phase: "execute" }`
- **THEN** Execute 阶段的 MessageBlock 自动折叠，仅显示标题和完成状态图标

### Requirement: 多轮 PEC 循环的展示
当发生多轮 PEC 循环时（Check fail），前端 SHALL 在每轮创建新的 Plan/Execute/Check 区块，标注轮次编号。

#### Scenario: 第二轮 PEC 展示
- **WHEN** 第一轮 Check 失败，进入第二轮
- **THEN** 前端显示"第 2 轮 · 规划中"等标题，与第一轮的区块区分

### Requirement: TS 类型层扩展
`src/lib/agents/types.ts` 的 `AgentOutputChunk.type` 联合类型 SHALL 包含 `"phase_start"` 和 `"phase_end"`。

#### Scenario: TypeScript 类型完整
- **WHEN** 审查 `AgentOutputChunk` 类型定义
- **THEN** `type` 字段的联合类型包含 `"phase_start"` | `"phase_end"`
