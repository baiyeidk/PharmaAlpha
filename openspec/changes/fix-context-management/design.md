## Context

当前 PEC Agent 的上下文管理存在三个层面的问题：

1. **指令冲突**：`route.ts` 向 agent 注入旧式 canvas 文本工具指令（要求 LLM 在回复中输出 raw JSON 行），与 PEC Agent 使用的原生 OpenAI function calling 互相矛盾，导致 LLM 行为不确定。
2. **组装碎片化**：PEC 四个阶段（Plan/Execute/Check/Synthesize）各自用 `list(chat_messages) + [...]` 手动拼装上下文，CHECK 阶段甚至丢弃了对话历史。
3. **无溢出防护**：工具返回的大段数据（如财报、网页内容）和多轮对话历史直接全量传入 LLM，没有任何截断或压缩。

相关文件：
- `src/app/api/chat/route.ts` — 注入 canvas system message
- `src/lib/agents/tool-definitions.ts` — 旧式文本工具提示
- `agents/supervisor_agent/pec_agent.py` — PEC 循环和上下文组装
- `agents/supervisor_agent/prompts.py` — 各阶段 system prompt

## Goals / Non-Goals

**Goals:**
- 消除 route.ts 与 PEC Agent 之间的上下文冲突
- 建立统一的 ContextBuilder，让各阶段通过声明式 API 组装上下文
- 所有 LLM 调用都有 token 预算守卫，防止超窗口
- CHECK 阶段能访问完整对话上下文
- 环境信息（画布状态、当前时间）结构化注入

**Non-Goals:**
- 跨会话持久记忆（用户画像、偏好存储）— 属于独立 change
- 自动摘要压缩（LLM 调用生成摘要）— 成本高，后续迭代
- Embedding/RAG 检索 — 后续独立功能
- 修改前端 `use-chat-stream.ts` 的消息发送逻辑

## Decisions

### Decision 1: 移除 route.ts 的 canvas system message 注入

**选择**：对 PEC Agent（supervisor_agent），不再注入 `getCanvasSystemMessage()` 和 `tools` 参数。

**替代方案**：
- A) 让 PEC Agent 忽略注入的消息 → 仍有噪音占用 token
- B) 在 PEC Agent 端过滤掉 → 防御性编程，增加耦合

**理由**：PEC Agent 有自己的 ToolRegistry 和原生 function calling，旧式文本指令完全多余。直接在源头移除最干净。对于其他 agent（如 `pharma_agent`），保留现有行为不变。

### Decision 2: ContextBuilder 设计为 Python 模块，非 Agent 子类

**选择**：新建 `agents/base/context_builder.py`，提供 `ContextBuilder` 类，PEC Agent 通过组合使用。

```
ctx = ContextBuilder(max_chars=60000)
ctx.set_system(prompt)
ctx.add_messages(chat_messages)
ctx.inject_environment(canvas_history=..., current_time=...)
ctx.inject_phase_context(steps=..., exec_results=...)
messages = ctx.build()  # 自动截断超限内容
```

**替代方案**：
- A) 直接在 PEC Agent 内部方法封装 → 不可复用，其他 agent 无法使用
- B) 做成 BaseAgent 的方法 → 过度耦合，并非所有 agent 都需要

**理由**：组合优于继承。独立模块便于测试、复用、渐进采用。

### Decision 3: 基于字符数的软限制，而非精确 token 计数

**选择**：使用字符数估算（1 中文字 ≈ 2 tokens，1 英文词 ≈ 1.3 tokens），设默认 `max_chars=60000`（约 30K-40K tokens），对超限内容按优先级截断。

**截断优先级**（从低到高）：
1. 工具返回结果 → 截断到每个结果最多 2000 字符
2. 历史对话消息 → 保留最近 N 条，丢弃最早的
3. 当前阶段注入内容 → 保留
4. System prompt → 永不截断

**替代方案**：
- A) 使用 tiktoken 精确计算 → 需要额外依赖，计算有延迟
- B) 不做限制 → 现状，会超窗口

**理由**：字符估算足够防止大多数溢出情况，零外部依赖，性能无损。后续如需精确控制再引入 tiktoken。

### Decision 4: 环境上下文通过 ContextBuilder 统一注入

**选择**：不再在 `build_synthesize_prompt()` 的参数中拼接 canvas_history，改为 ContextBuilder 统一管理环境上下文块。

环境上下文包括：
- `canvas_history`：画布上已有的节点列表
- `current_time`：当前时间（LLM 无法自知）
- 后续可扩展：用户分析过的股票列表、上传的文件列表等

**理由**：环境信息属于"agent 需要知道的世界状态"，应该与 prompt 构建解耦。

## Risks / Trade-offs

- **[Risk] 字符估算不精确** → 设 60000 上限对 128K 窗口模型留有充足余量（实际约 30-40K tokens），误差不构成问题。若对接 8K 窗口模型需调低。
  
- **[Risk] 移除 canvas system message 影响非 PEC agent** → 仅对 supervisor_agent 移除，其他 agent 路径保持不变。通过 agent name 判断分支。

- **[Trade-off] ContextBuilder 增加了抽象层** → 但换来了可测试性和一致性，PEC Agent 代码量实际会减少。

- **[Risk] CHECK 阶段传入完整上下文后 token 用量增加** → 可控，CHECK 使用 JSON 输出的 non-streaming 调用，内容较少。
