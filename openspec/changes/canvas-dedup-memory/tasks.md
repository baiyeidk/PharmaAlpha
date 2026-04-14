## 1. 工具层硬去重

- [x] 1.1 在 `agents/base/tools/builtin/canvas_tools.py` 中新增模块级变量 `_added_chart_tickers: set[frozenset[str]]` 和 `_added_text_labels: set[str]`
- [x] 1.2 修改 `canvas_add_chart`：调用前检查 `frozenset(tickers)` 是否已在集合中，已存在则返回跳过提示、不 emit 事件
- [x] 1.3 修改 `canvas_add_text`：调用前检查 label 是否已在集合中，已存在则返回跳过提示、不 emit 事件

## 2. PEC Agent 记忆追踪

- [x] 2.1 在 `PECAgent.__init__` 中初始化 `self._canvas_history: list[dict] = []`
- [x] 2.2 在 `_run_tool_loop` 中，当 `tool_result` 成功且 `fn_name` 以 `canvas_` 开头时，将调用信息追加到 `self._canvas_history`

## 3. Synthesize Prompt 注入

- [x] 3.1 修改 `build_synthesize_prompt()` 签名，新增 `canvas_history: list[dict] = None` 参数
- [x] 3.2 当 `canvas_history` 非空时，在 prompt 尾部生成 "## 画布上已有的内容" 列表，逐项列出已添加的图表和文本节点
- [x] 3.3 在 `PECAgent.execute` 的 Synthesize 阶段调用时传入 `self._canvas_history`

## 4. 验证

- [ ] 4.1 启动开发服务器，提问"分析以岭药业"，确认 Canvas 上只出现一个走势图节点，不重复
