## 1. 协议层扩展

- [x] 1.1 在 `agents/base/protocol.py` 中新增 `PhaseStart` 和 `PhaseEnd` 数据类（字段：phase, round），实现 `to_json()`
- [x] 1.2 更新 `agents/base/base_agent.py` 的 `AgentOutput` Union 类型包含 `PhaseStart` 和 `PhaseEnd`
- [x] 1.3 在 `src/lib/agents/types.ts` 的 `AgentOutputChunk.type` 联合类型中添加 `"phase_start"` | `"phase_end"`

## 2. PEC Agent 引擎实现

- [x] 2.1 创建 `agents/supervisor_agent/pec_agent.py`，实现 `PECAgent(BaseAgent)` 类骨架：`__init__` 初始化统一 ToolRegistry 和 LLM 客户端
- [x] 2.2 实现统一工具池注册：在 `PECAgent.__init__` 中调用 `register_all_tools(registry)` 注册所有内置工具（stock、financial、web、pdf、canvas_add_chart）
- [x] 2.3 实现 `_call_llm_json(system_prompt, messages)` 辅助方法：调用 LLM 返回结构化 JSON（非 streaming，使用 `response_format`）
- [x] 2.4 实现 `_call_llm_stream(system_prompt, messages, tools?)` 辅助方法：调用 LLM 返回 streaming 响应，支持可选工具
- [x] 2.5 实现 Plan 阶段：yield `PhaseStart("plan")`，调用 `_call_llm_json(PLAN_PROMPT, context)`，解析步骤列表，yield `AgentPlan(steps)`，yield `PhaseEnd("plan")`
- [x] 2.6 实现 Execute 阶段：yield `PhaseStart("execute")`，将 Plan 步骤作为指令发给 LLM，内部 tool loop（LLM → tool_calls → execute → tool results → LLM），每个 tool_start/tool_result 都 yield 给上层，yield `PhaseEnd("execute")`
- [x] 2.7 实现 Check 阶段：yield `PhaseStart("check")`，调用 `_call_llm_json(CHECK_PROMPT, context + execute_results)`，解析 passed/gaps，yield `AgentCheck(passed, summary, gaps)`，yield `PhaseEnd("check")`
- [x] 2.8 实现 PEC 循环：在 `execute()` 中用 for loop 串联 Plan → Execute → Check，Check fail 时将 gaps 加入 context 继续循环，最大 3 轮
- [x] 2.9 实现 Synthesize 阶段：yield `PhaseStart("synthesize")`，调用 `_call_llm_stream(SYNTHESIZE_PROMPT, all_results, canvas_tools)`，流式输出 chunk，yield `AgentResult`，yield `PhaseEnd("synthesize")`
- [x] 2.10 集成 `_LLMFileLogger`：每个阶段的 LLM 调用都记录到 `agents/logs/` 文件

## 3. PEC Prompt 设计

- [x] 3.1 重写 `agents/supervisor_agent/prompts.py`，提供 4 个 prompt 函数：`build_plan_prompt()`、`build_execute_prompt()`、`build_check_prompt()`、`build_synthesize_prompt()`
- [x] 3.2 Plan prompt：角色为任务规划器，输入用户请求，输出 JSON `{ "steps": [{"id": "1", "description": "..."}] }`
- [x] 3.3 Execute prompt：角色为数据获取执行器，列出所有可用工具及用途，按 Plan 步骤逐步执行
- [x] 3.4 Check prompt：角色为质量审查员，输入用户原始请求 + Execute 结果，输出 JSON `{ "passed": bool, "summary": "...", "gaps": ["..."] }`
- [x] 3.5 Synthesize prompt：角色为医药投资分析报告合成专家，基于所有数据合成结构化报告，可使用 canvas 工具展示图表

## 4. 入口和旧代码清理

- [x] 4.1 重写 `agents/supervisor_agent/agent.py` 的 `__main__` 入口，使用 `PECAgent` 替代旧的 `SupervisorAgent`
- [x] 4.2 删除 `agents/supervisor_agent/sub_agents.py`
- [x] 4.3 删除 `agents/pharma_analyst/` 目录
- [x] 4.4 删除 `agents/stock_analyst/` 目录
- [x] 4.5 删除 `agents/investment_advisor/` 目录

## 5. route.ts 修复

- [x] 5.1 删除 `src/app/api/chat/route.ts` 中的 `toolCallPattern` 正则常量
- [x] 5.2 简化 `captureAndForward.transform` 中 `chunk`/`result` 类型的处理：移除 `matchAll` 分支，直接透传文本
- [x] 5.3 在 `passthroughTypes` 集合中添加 `"phase_start"` 和 `"phase_end"`

## 6. 前端 PEC 阶段展示

- [x] 6.1 修改 `src/hooks/use-chat-stream.ts`：处理 `phase_start` / `phase_end` 事件，创建对应的 MessageBlock（type 可复用 "sub_agent" 或新增 "phase"）
- [x] 6.2 在 MessageBlock 中记录 phase 名称和 round 轮次，`phase_end` 时标记 block 为 done 并自动折叠
- [x] 6.3 修改 `src/components/chat/agent-block.tsx` 或新建 `phase-block.tsx`：按阶段展示标题（"规划中"/"执行中"/"审查中"），内嵌 tool 事件和审查结果
- [x] 6.4 Synthesize 阶段的内容直接追加到主消息区域（不在折叠块内）

## 7. 验证

- [ ] 7.1 启动开发服务器，提问"分析以岭药业"，确认 PEC 循环正常运行：前端显示 Plan → Execute → Check → Synthesize 四个阶段
- [ ] 7.2 确认 Canvas 无重复节点、无 JSON 泄漏
- [ ] 7.3 检查 `agents/logs/` 日志文件确认每个阶段的 LLM 输入输出都有记录

> 注：7.1-7.3 为人工验证任务，需启动 `npm run dev` 后手动测试
