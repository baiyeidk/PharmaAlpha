## 1. 清理上下文冲突（context-cleanup）

- [x] 1.1 修改 `src/app/api/chat/route.ts`：当 agent.name 为 `supervisor_agent` 时，跳过 `getCanvasSystemMessage()` 注入和 `tools` 参数传递
- [x] 1.2 确认 `captureAndForward` 中的 `canvas.` tool_call 拦截逻辑不依赖 canvas system message 的存在（应已独立，验证即可）
- [x] 1.3 验证其他 agent（如 `pharma_agent`、`employee_investment_team`）路径不受影响

## 2. ContextBuilder 核心模块

- [x] 2.1 新建 `agents/base/context_builder.py`，实现 `ContextBuilder` 类骨架：`__init__(max_chars=60000)`、`set_system()`、`add_messages()`、`build()` 方法
- [x] 2.2 实现 `inject_environment()` 方法：接受 `canvas_history`、`current_time` 等参数，生成环境上下文消息
- [x] 2.3 实现 `inject_phase_context()` 方法：接受阶段特定内容（plan_steps、exec_results、check_feedback 等），追加为 user 消息
- [x] 2.4 实现 `build()` 中的 token 预算守卫：单条工具结果截断（>2000 字符）、总量超限时从最早消息开始移除（保留最近 2 条 user + system prompt）
- [x] 2.5 为 ContextBuilder 编写基础单元测试（截断逻辑、优先级保留）

## 3. PEC Agent 重构

- [x] 3.1 在 `pec_agent.py` 中通过 `_build_ctx()` 工厂方法使用 `ContextBuilder`
- [x] 3.2 重构 Plan 阶段：用 `ContextBuilder` 替代手动 `list(chat_messages) + [...]` 拼装
- [x] 3.3 重构 Execute 阶段：用 `ContextBuilder` 组装，将 plan_steps 和 prev_results 通过 `inject_phase_context()` 注入
- [x] 3.4 重构 Check 阶段：用 `ContextBuilder` 组装，传入完整 chat_messages 而非仅 user_question + exec_text[:4000]
- [x] 3.5 重构 Synthesize 阶段：用 `ContextBuilder` 组装，环境上下文通过 `inject_environment()` 注入
- [x] 3.6 更新 `prompts.py`：`build_synthesize_prompt()` 移除 `canvas_history` 参数，环境信息改由 ContextBuilder 注入

## 4. 环境上下文增强

- [x] 4.1 在 `inject_environment()` 中添加当前时间注入：格式 "当前时间: YYYY-MM-DD HH:MM"
- [x] 4.2 在 Execute 和 Synthesize 阶段调用 `inject_environment(canvas_history=self._canvas_history)`

## 5. 验证

- [ ] 5.1 启动开发服务器，选择 supervisor_agent，发送"分析以岭药业"，确认无旧式 JSON tool_call 出现在文本中
- [ ] 5.2 确认 Canvas 走势图和文本节点正常添加
- [ ] 5.3 发送多轮追问（如"它跟恒瑞医药比呢"），确认 CHECK 阶段能理解上下文
- [ ] 5.4 检查 agent 日志，确认上下文总量在合理范围内
