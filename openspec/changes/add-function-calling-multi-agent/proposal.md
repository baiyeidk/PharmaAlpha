## Why

当前 agent 系统存在两个根本性限制：(1) 工具调用依赖 system prompt 引导 LLM 在文本中输出 JSON 行，再由服务端正则匹配提取——格式脆弱（嵌套 JSON 会打断正则 `\{[^}]*\}`）、不支持工具执行结果回传给 LLM 形成闭环推理；(2) "多 agent" 仅是单进程内 LangGraph 图节点间的角色模拟，无法实现真正的 agent 间路由、委派和协作。引入原生 function calling 和多 agent 协作框架，是让平台从"demo 级"迈向"生产级"智能投资顾问的关键一步。

## What Changes

- **原生 Function Calling 协议**：扩展 `BaseAgent` 协议和 `LLMPort` 抽象，支持通过 OpenAI `tools` 参数声明工具 schema，LLM 返回结构化 `tool_calls`，agent 执行工具后将结果回传 LLM 形成 tool-use loop
- **Tool Registry 机制**：在 Python agent 侧引入工具注册表，agent 可声明式注册可用工具（canvas 操作、股票查询、数据检索等），自动生成 OpenAI function calling schema
- **Tool Execution Loop**：agent 内部实现 LLM → tool_calls → execute → tool results → LLM 的循环，直到 LLM 返回纯文本结束，支持多轮工具调用
- **丰富的内置工具集**：为 agent 提供开箱即用的基础工具——PDF 文本提取（研报解读）、股票行情/K线查询、网页搜索与抓取（财报/新闻检索）、公司财务数据获取、Canvas 画布操作（图表/文本/图片节点）
- **平台 API 桥接**：Python agent 通过 HTTP 统一调用 Next.js 已有的 API 端点（stocks、files、canvas），保持单一数据入口和统一鉴权
- **多 Agent Plan-Execute-Check 协作**：引入 Supervisor Agent，采用 Plan→Execute→Check 循环——先规划（选择子 agent 和任务分配）、再执行（委派专业子 agent）、后检查（评审结果质量），不满足则迭代
- **Agent 间通信协议**：定义 agent 间的消息传递格式（委派请求、执行结果、上下文共享），复用现有 JSON Lines 协议扩展
- **TS 执行层升级**：扩展 `executor.ts` 和 `route.ts` 以支持 agent 内部多轮工具调用的流式输出和 tool result 事件

## Capabilities

### New Capabilities
- `native-function-calling`: 原生 function calling 能力——工具 schema 声明、LLM tool_calls 解析、tool execution loop、工具结果回传、多轮工具链推理
- `agent-tool-registry`: Agent 工具注册表——声明式工具定义、自动 schema 生成、工具发现与绑定、内置工具集（canvas、stock、pdf、web-search、financial-report）
- `multi-agent-routing`: 多 Agent 路由与协作——Supervisor 路由 agent、意图分类与 agent 选择、子 agent 委派执行、结果汇聚与合成

### Modified Capabilities

（无现有 spec 需要修改——现有 canvas tool_call 的 system prompt 方式将保持向后兼容，新 function calling 为并行路径）

## Impact

- **核心变更**：`agents/base/` 协议层扩展（protocol.py、base_agent.py），新增 tool registry 模块
- **新增代码**：`agents/base/tools/` 工具框架，`agents/supervisor_agent/` 路由 agent，各专业子 agent 升级
- **TS 层调整**：`executor.ts` 新增 tool_result 事件类型，`route.ts` 处理多轮 tool 交互的流式输出
- **协议扩展**：JSON Lines 协议新增 `tool_result` 类型，`AgentInput` 新增 `tools` schema 传递（**BREAKING**：旧 agent 不受影响，新类型为可选增量）
- **新增 Python 依赖**：`pdfplumber`（PDF 文本/表格提取）、`requests`（HTTP 客户端）、`beautifulsoup4`（HTML 解析）
- **环境变量**：新增 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`（可选）、`PLATFORM_API_BASE`（可选）
- **前端**：基本无变更——`tool_call` 和 `chunk` 事件格式向后兼容，新增的 `tool_result`/`plan`/`check` 等事件前端可选消费
