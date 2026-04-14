## Tasks

### 1. 协议层扩展

- [x] 1.1 在 `agents/base/protocol.py` 中新增 `AgentAgentChunk` 数据类（type=`"agent_chunk"`，字段：`agent_name`、`content`），实现 `to_json()`
- [x] 1.2 在 `agents/base/base_agent.py` 的 `AgentOutput` Union 类型中添加 `AgentAgentChunk`
- [x] 1.3 在 `src/lib/agents/types.ts` 的 `AgentOutputChunk.type` 联合类型中添加 `"agent_chunk"`

### 2. Supervisor 转发逻辑改造

- [x] 2.1 在 `agents/supervisor_agent/agent.py` 的 `delegate_to_agent` 函数中，将子 Agent 的 `chunk` 输出转为 `AgentAgentChunk(agent_name=agent_name, content=output.content)` 再 emit
- [x] 2.2 子 Agent 的 `tool_start`/`tool_result` 事件转发时，在 JSON 中注入 `agent_name` 字段（修改 `to_json()` 返回值或创建包装事件）
- [x] 2.3 子 Agent 的 `result` 事件不作为 `chunk` 转发（已有 `AgentDelegateResult` 汇总）
- [x] 2.4 Supervisor 自身的 `chunk` 输出保持原样（type="chunk"，无 agent_name）

### 3. TS 层透传

- [x] 3.1 在 `src/app/api/chat/route.ts` 的 `passthroughTypes` 集合中添加 `"agent_chunk"`
- [x] 3.2 确认 `agent_chunk` 事件能附上 `conversationId` metadata 正常透传到 SSE

### 4. 前端数据模型扩展

- [x] 4.1 在 `src/hooks/use-chat-stream.ts` 中新增 `MessageBlock` 和 `ToolEvent` 接口定义
- [x] 4.2 扩展 `ChatMessage` 接口，新增可选的 `blocks: MessageBlock[]` 字段
- [x] 4.3 重构 `sendMessage` 中的 SSE 事件处理逻辑：
  - 收到普通 `chunk` → 追加到当前 supervisor block（或创建新的）
  - 收到 `agent_delegate` → 创建新的 sub_agent block（status: streaming）
  - 收到 `agent_chunk` → 追加 content 到匹配 agent_name 的活跃 block
  - 收到 `tool_start`/`tool_result`（带 agent_name）→ 添加到对应 block 的 toolEvents
  - 收到 `tool_start`/`tool_result`（无 agent_name）→ 添加到当前 supervisor block
  - 收到 `agent_result` → 标记对应 block 为 done
  - 收到 `result` → 创建最终 supervisor block 或追加到现有 block
- [x] 4.4 没有 blocks 的消息（旧 agent 或历史消息）降级为原有的单文本渲染

### 5. AgentBlock UI 组件

- [x] 5.1 创建 `src/components/chat/agent-block.tsx`：sub_agent block 可折叠卡片组件
  - 头部：Agent 名称图标 + 显示名 + 任务描述 + 折叠按钮 + streaming/done 状态
  - 内容区：MarkdownRenderer 渲染流式内容
  - 工具条：tool_start/tool_result 以小标签/inline 状态显示
  - 折叠态：仅显示头部 + 完成状态标记
- [x] 5.2 创建 `src/components/chat/tool-event-badge.tsx`：工具调用状态小标签组件（名称 + loading/success/error 图标）

### 6. ChatMessage 重构

- [x] 6.1 修改 `src/components/chat/chat-message.tsx`：当 `blocks` 存在且非空时，渲染 block 列表而非单文本
- [x] 6.2 supervisor block 渲染为带 "协调者" 标识的文本区域
- [x] 6.3 sub_agent block 渲染为 `AgentBlock` 组件
- [x] 6.4 无 blocks 时保持原有渲染逻辑（向后兼容）

### 7. Agent 显示名称映射

- [x] 7.1 在 `use-chat-stream` 或 `chat-view` 中建立 agent_name → displayName 映射（从 `agent_delegate` 事件或静态配置）
- [x] 7.2 `AgentBlock` 组件显示中文友好名称（stock_analyst → "股票分析师"，pharma_analyst → "医药分析师" 等）
