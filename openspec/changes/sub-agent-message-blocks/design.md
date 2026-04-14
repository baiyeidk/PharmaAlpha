## Context

当前 Supervisor Agent 通过 `delegate_to_agent` 工具委派子 Agent 执行分析。子 Agent 的流式输出（`chunk`/`result`/`tool_start`/`tool_result`）通过 `self._emit(output)` 直接发送到 stdout，前端将所有 `chunk` 内容追加到同一个助手消息气泡中。

结果是用户看到一大段混杂的文本流，无法区分哪段来自 Supervisor、哪段来自 stock_analyst、哪段来自 pharma_analyst。工具调用状态（tool_start/tool_result）也被 `onAgentEvent` 回调吞掉，不显示给用户。

目标是让前端将一次完整的对话回复渲染为多个可视"块"（blocks），每个块对应一个执行阶段（Supervisor 思考、子 Agent A 执行、子 Agent B 执行、Supervisor 总结），效果类似 Cursor 的分步执行展示。

## Goals / Non-Goals

**Goals:**
- 前端能区分每段流式内容来自哪个 Agent（Supervisor vs 各子 Agent）
- 子 Agent 的输出在 UI 中渲染为独立的可折叠卡片块，包含 agent 名称、任务描述、流式内容
- 工具调用状态（tool_start / tool_result）内联显示在对应的 agent block 内
- Supervisor 自身的文本（规划、总结）作为独立块展示
- 向后兼容：非 Supervisor agent（如 pharma_agent）的旧行为不受影响

**Non-Goals:**
- 不重构 Python agent 间的通信协议（仍使用进程内调用）
- 不实现 block 的持久化存储（数据库仍存完整文本）
- 不实现 block 的编辑或重试功能

## Decisions

### Decision 1: 协议层 — 用 `agent_name` 字段标注消息来源

**选择**: 在 Supervisor 转发子 Agent 输出时，将 `chunk` 事件包装为新的 `agent_chunk` 类型，携带 `agent_name` 字段。

```json
{"type": "agent_chunk", "agent_name": "stock_analyst", "content": "正在查询..."}
```

**替代方案**: 在每个 `chunk` 事件中添加可选的 `agent_name` 字段。
**拒绝理由**: 使用新 type 更清晰，前端可以用 `switch(chunk.type)` 直接路由，不需要每次检查可选字段。旧 agent 不会发 `agent_chunk`，天然兼容。

### Decision 2: 前端数据模型 — Block 列表

**选择**: 扩展 `ChatMessage` 接口，新增 `blocks` 数组：

```typescript
interface MessageBlock {
  id: string;
  type: "supervisor" | "sub_agent" | "tool_activity";
  agentName?: string;
  agentDisplayName?: string;
  task?: string;
  content: string;
  toolEvents: ToolEvent[];
  status: "streaming" | "done" | "error";
  collapsed?: boolean;
}
```

当 `blocks` 为空或不存在时，降级为当前的单文本渲染（向后兼容）。

**替代方案**: 将每个 block 作为独立的 ChatMessage。
**拒绝理由**: 破坏"一次问答一条消息"的模型，持久化和历史加载会更复杂。Block 是纯展示层概念。

### Decision 3: 前端 Block 生命周期管理

`use-chat-stream` hook 中的状态机：

1. **收到 `chunk`（无 agent_name）** → 追加到当前 "supervisor" block（如果不存在则创建）
2. **收到 `agent_delegate`** → 创建新的 "sub_agent" block（status: streaming）
3. **收到 `agent_chunk`** → 追加内容到匹配 agent_name 的活跃 block
4. **收到 `tool_start` / `tool_result`** → 添加到当前活跃 block 的 `toolEvents`
5. **收到 `agent_result`** → 将对应 block 标记为 done
6. **收到 `result`** → 如果有文本，创建最终 supervisor block

### Decision 4: UI 渲染 — AgentBlock 组件

每个 sub_agent block 渲染为可折叠卡片：
- **头部**: Agent 图标 + 显示名 + 任务描述 + 展开/折叠按钮 + 状态指示
- **内容区**: Markdown 渲染的流式文本
- **工具条**: tool_start/tool_result 事件以小标签形式显示

Supervisor block 无特殊包装，直接渲染文本（但有 "Supervisor" 标识）。

## Risks / Trade-offs

- **[消息持久化不含 block 结构]** → 历史消息加载后不显示 block 分割。可接受，后续可通过在数据库 metadata 中存 block 信息解决。
- **[子 Agent 名称映射]** → 前端需要一份 agent_name → displayName 的映射。通过 `agent_delegate` 事件中携带的信息建立。
- **[旧 Agent 兼容]** → 没有 blocks 的消息降级为当前的单文本渲染，零风险。
