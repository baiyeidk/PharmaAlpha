## Why

当前多 Agent 系统采用"领域子 Agent"架构（pharma_analyst / stock_analyst / investment_advisor），由 Supervisor 委派任务。实际运行暴露三个严重问题：(1) 角色职责重叠，多个 Agent 重复获取相同数据、重复创建 Canvas 节点；(2) 没有真正的审查纠错机制，Supervisor 的"Check"只是 prompt 里的一句话，不是独立的执行步骤；(3) tool_call JSON 通过正则从文本中提取，正则无法处理嵌套 JSON 导致原始 JSON 泄漏到前端。

需要将架构重构为单进程 PEC（Plan-Execute-Check）内部循环：一个 Agent 进程内，用不同的 prompt 完成规划、执行（含工具调用）、审查三个阶段，Check 不通过则带着缺失项重新 Plan，形成闭环。

## What Changes

- **BREAKING** 废弃 `pharma_analyst/`、`stock_analyst/`、`investment_advisor/` 三个子 Agent 目录及其 `sub_agents.py` 委派机制
- **BREAKING** 重写 `supervisor_agent/` 为 PEC 循环 Agent：Plan（结构化步骤）→ Execute（统一工具池调用）→ Check（审查完整性，fail 则回 Plan）→ Synthesize（合成最终输出）
- 统一工具池：所有工具在一个 ToolRegistry 中注册，取消领域分拆
- 前端保留 PEC 阶段分块展示（plan / execute / check / synthesize），协议层新增或复用事件类型支持阶段流转的可视化
- 修复 `route.ts` 中 tool_call JSON 泄漏 bug：删除正则提取逻辑，完全依赖协议层 `type: "tool_call"` 事件
- Canvas 操作收紧：仅在 Execute 阶段按需调用 `canvas_add_chart`，Synthesize 阶段可选一个 `canvas_add_text` 汇总

## Capabilities

### New Capabilities
- `pec-loop-engine`: PEC 内部循环引擎——单进程内 Plan/Execute/Check 三阶段循环，Check fail 带缺失项回 Plan，最大循环次数可配
- `pec-frontend-phases`: 前端 PEC 阶段分块展示——规划中/执行中/审查中/合成中的可视化展示，为后续动画效果留接口
- `canvas-tool-call-fix`: 修复 route.ts 中 tool_call JSON 提取逻辑，确保 Canvas 操作不泄漏原始 JSON

### Modified Capabilities

## Impact

- **Python agents**：废弃 `pharma_analyst/`、`stock_analyst/`、`investment_advisor/` 目录；重写 `supervisor_agent/agent.py`、`supervisor_agent/prompts.py`；删除 `supervisor_agent/sub_agents.py`
- **协议层**：`agents/base/protocol.py` 可能需要新增 PEC 阶段事件类型；`src/lib/agents/types.ts` 对应扩展
- **Next.js API**：`src/app/api/chat/route.ts` 删除 toolCallPattern 正则，透传 PEC 阶段事件
- **前端**：`src/hooks/use-chat-stream.ts` 和 `src/components/chat/` 适配 PEC 阶段分块
- **不影响**：数据库结构、认证系统、Canvas 组件本身
