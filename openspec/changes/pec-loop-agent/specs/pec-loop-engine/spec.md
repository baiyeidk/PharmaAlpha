## ADDED Requirements

### Requirement: PEC Agent 实现 Plan-Execute-Check 内部循环
PEC Agent SHALL 在单个进程内实现 Plan → Execute → Check 三阶段循环。当 Check 判定结果不完整时，SHALL 带着缺失项回到 Plan 阶段重新规划，直到 Check 通过或达到最大循环次数。

#### Scenario: 正常一轮通过
- **WHEN** 用户提问"分析恒瑞医药"
- **THEN** Agent 依次执行 Plan（输出步骤列表）→ Execute（调用工具获取数据）→ Check（判定通过）→ Synthesize（合成最终报告），整个过程在一个进程内完成

#### Scenario: Check 不通过触发重新 Plan
- **WHEN** Check 阶段判定缺少关键数据（如"缺少 K 线技术分析"）
- **THEN** Agent 将缺失项作为上下文传入新一轮 Plan，重新规划步骤并执行，直到 Check 通过

#### Scenario: 达到最大循环次数
- **WHEN** PEC 循环连续 3 轮 Check 都不通过
- **THEN** Agent SHALL 停止循环，基于已有数据执行 Synthesize 并输出结果，附带提示"部分数据未能获取"

### Requirement: Plan 阶段输出结构化步骤
Plan 阶段 SHALL 调用 LLM 并返回结构化 JSON 格式的步骤列表，每个步骤包含任务描述。Plan 阶段不使用工具。

#### Scenario: Plan 返回 JSON 步骤列表
- **WHEN** Plan 阶段 LLM 调用完成
- **THEN** 输出包含 `steps` 数组的 JSON 对象，每个 step 包含 `id`(string) 和 `description`(string) 字段

### Requirement: Execute 阶段使用统一工具池
Execute 阶段 SHALL 注册所有内置工具（stock、financial、web、pdf、canvas_add_chart），通过 LLM tool loop 自主决定调用顺序。每个 tool_start 和 tool_result 事件 SHALL 被 yield 给上层。

#### Scenario: Execute 阶段工具调用对用户可见
- **WHEN** Execute 阶段 LLM 决定调用 `get_stock_quote`
- **THEN** 先 yield `tool_start` 事件，执行后 yield `tool_result` 事件，前端可以展示工具调用状态

### Requirement: Check 阶段输出结构化审查结果
Check 阶段 SHALL 调用 LLM 审查 Execute 阶段收集的所有数据，返回结构化 JSON 包含 `passed`(bool)、`summary`(string)、`gaps`(string[])。Check 阶段不使用工具。

#### Scenario: Check 通过
- **WHEN** Check LLM 判定数据足够回答用户问题
- **THEN** 返回 `{ "passed": true, "summary": "数据完整", "gaps": [] }`

#### Scenario: Check 不通过
- **WHEN** Check LLM 判定缺少关键数据
- **THEN** 返回 `{ "passed": false, "summary": "缺少技术分析", "gaps": ["K线数据未获取"] }`

### Requirement: Synthesize 阶段流式合成最终报告
Synthesize 阶段 SHALL 基于所有 Execute 结果调用 LLM 合成结构化的最终分析报告，输出 SHALL 通过 streaming chunk 事件传递给前端。Synthesize 阶段可选调用 `canvas_add_chart` 和 `canvas_add_text`。

#### Scenario: Synthesize 流式输出
- **WHEN** Synthesize 阶段开始
- **THEN** 最终报告通过多个 `chunk` 事件流式传递给前端，最后以 `result` 事件结束

### Requirement: 废弃子 Agent 目录
`pharma_analyst/`、`stock_analyst/`、`investment_advisor/` 目录及 `supervisor_agent/sub_agents.py` SHALL 被删除。

#### Scenario: 子 Agent 目录不存在
- **WHEN** 查看 `agents/` 目录结构
- **THEN** 不存在 `pharma_analyst/`、`stock_analyst/`、`investment_advisor/` 目录

### Requirement: 协议层新增阶段事件
协议层 SHALL 新增 `phase_start` 和 `phase_end` 事件类型，携带 `phase` 名称和 `round` 轮次编号。

#### Scenario: 每个阶段开始和结束都有事件
- **WHEN** PEC Agent 进入 Plan 阶段
- **THEN** 先 yield `phase_start { phase: "plan", round: 1 }`，阶段结束后 yield `phase_end { phase: "plan", round: 1 }`
