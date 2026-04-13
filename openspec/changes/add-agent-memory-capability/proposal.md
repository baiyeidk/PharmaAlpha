## Why

当前投资建议 agent 对话主要依赖当轮输入，缺少稳定记忆能力，导致多轮分析中预算、风险偏好和已确认事实容易丢失。为提升回答连续性与效率，需要为该 agent 增加记忆机制，并支持跨轮检索与上下文压缩。

## What Changes

- 新增记忆能力框架，仅面向投资建议 agent，支持短期会话记忆与长期用户记忆两层结构。
- 增加记忆写入策略：从对话中提取可持久化的事实、偏好、约束和决策结论。
- 增加记忆检索策略：在回答前按相关性召回记忆片段并注入上下文。
- 增加记忆压缩策略：对多轮上下文生成高密度摘要，保留关键约束与证据索引。
- 增加记忆治理策略：TTL/清理、冲突更新（最新优先）与来源追踪。
- 与现有多 agent 协作（planner、executor、evaluator）打通，支持各角色共享记忆视图且对用户无感。
- 优先采用开源记忆管理方案进行集成，减少自研复杂度与交付周期。

## Capabilities

### New Capabilities
- `agent-memory-core`: 记忆数据模型、写入与更新规则，覆盖会话记忆与用户长期记忆。
- `agent-memory-retrieval`: 记忆检索与注入能力，按问题相关性、时间与可信度召回上下文。
- `agent-memory-compression`: 多轮上下文压缩能力，输出简洁结构化摘要并保留关键约束。
- `agent-memory-governance`: 记忆治理能力，包含敏感信息处理、过期清理、冲突合并与审计追踪。
- `agent-memory-open-source-integration`: 基于开源组件的记忆管理集成能力，支持快速接入与可替换架构。

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `agents/base/` 需要扩展记忆接口协议（读、写、检索、压缩）。
  - 投资建议 agent 及其 planner/executor/evaluator 流程需要接入记忆读写与上下文注入。
  - `src/lib/agents/` 可能需要扩展请求上下文组装与记忆策略配置。
  - `src/app/api/chat/` 与相关会话接口可能需要增加内部记忆策略参数（无需前端新增显式开关）。
- APIs:
  - 可能新增记忆管理 API（查看、清理、禁用某类记忆）或扩展现有 chat 请求参数。
- Dependencies/Systems:
  - 复用现有数据库与会话模型，必要时新增记忆表/索引。
  - 保持与现有 JSON Lines + SSE 协议兼容，不引入破坏性变更。
