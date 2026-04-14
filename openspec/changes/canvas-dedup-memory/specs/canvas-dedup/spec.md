## ADDED Requirements

### Requirement: canvas_add_chart 按 tickers 硬去重
`canvas_add_chart` 工具 SHALL 在模块级维护已添加的 tickers 集合。当调用的 tickers 组合已存在时，SHALL 返回提示字符串而不 emit `AgentToolCall` 事件。

#### Scenario: 首次添加某只股票的走势图
- **WHEN** 调用 `canvas_add_chart(label="恒瑞医药", tickers=["600276"])`，且 `["600276"]` 未被添加过
- **THEN** 正常 emit `AgentToolCall` 事件，返回确认字符串，并将 `frozenset(["600276"])` 加入已添加集合

#### Scenario: 重复添加同一只股票的走势图
- **WHEN** 调用 `canvas_add_chart(label="恒瑞医药走势", tickers=["600276"])`，且 `["600276"]` 已被添加过
- **THEN** 不 emit 事件，返回 `"走势图已存在，跳过: 600276"`

### Requirement: canvas_add_text 按 label 硬去重
`canvas_add_text` 工具 SHALL 在模块级维护已添加的 label 集合。当相同 label 已存在时，SHALL 返回提示字符串而不 emit 事件。

#### Scenario: 重复添加同 label 的文本节点
- **WHEN** 调用 `canvas_add_text(label="分析摘要", content="...")`，且 label `"分析摘要"` 已被添加过
- **THEN** 不 emit 事件，返回 `"文本节点已存在，跳过: 分析摘要"`

### Requirement: PEC Agent 追踪 Canvas 操作历史
`PECAgent` SHALL 在 PEC 循环内维护 `_canvas_history` 列表，记录每次成功的 Canvas 工具调用信息。

#### Scenario: Execute 阶段的 canvas 调用被记录
- **WHEN** Execute 阶段成功调用 `canvas_add_chart`
- **THEN** `_canvas_history` 中新增一条记录，包含工具名称、label 和 tickers

### Requirement: Synthesize prompt 注入已有 Canvas 节点
`build_synthesize_prompt()` SHALL 接受 `canvas_history` 参数，当非空时在 prompt 中生成"已添加到画布的内容"列表，明确告知 LLM 不要重复创建。

#### Scenario: Synthesize 知道 Execute 已添加图表
- **WHEN** Execute 阶段已添加 "以岭药业" 的走势图
- **THEN** Synthesize prompt 包含文本"画布上已有: 以岭药业 走势图 (002603)"，LLM 不再调用 `canvas_add_chart` 添加相同股票
