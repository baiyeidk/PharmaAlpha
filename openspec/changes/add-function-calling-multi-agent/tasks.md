## 1. 协议层扩展

- [x] 1.1 在 `agents/base/protocol.py` 中新增 `AgentToolStart`、`AgentToolResult`、`AgentPlan`、`AgentCheck`、`AgentDelegate`、`AgentDelegateResult` 数据类及 `to_json()` 方法
- [x] 1.2 在 `agents/base/base_agent.py` 中确保 `_emit()` 支持新增的事件类型
- [x] 1.3 在 `src/lib/agents/types.ts` 中扩展 `AgentOutputChunk` 联合类型，添加 `tool_start`、`tool_result`、`plan`、`check`、`agent_delegate`、`agent_result` 类型定义

## 2. Tool Registry 框架

- [x] 2.1 创建 `agents/base/tools/__init__.py`，导出公共 API
- [x] 2.2 实现 `agents/base/tools/schema.py`：从 Python 类型注解（str/int/float/bool/list）和 docstring 生成 OpenAI function schema
- [x] 2.3 实现 `agents/base/tools/registry.py`：`ToolRegistry` 类，支持 `register()` 装饰器、`get_schemas()` 返回 OpenAI tools 数组、`execute(name, args)` 调用注册函数
- [x] 2.4 实现 `@tool(description=...)` 装饰器，附加元数据到函数对象
- [x] 2.5 实现工具执行异常捕获：执行失败时返回错误字符串而非抛出异常
- [x] 2.6 实现 `ToolNotFoundError` 异常和未注册工具的错误处理

## 3. 平台 API 客户端

- [x] 3.1 创建 `agents/base/platform_api.py`：`PlatformAPIClient` 类，封装对 Next.js API 的 HTTP 调用（`PLATFORM_API_BASE` 环境变量，默认 `http://localhost:3000/api`），支持 GET/POST + Bearer `AGENT_API_KEY` 鉴权
- [x] 3.2 在 `src/lib/agents/executor.ts` 中注入 `PLATFORM_API_BASE` 环境变量（复用已有的端口检测逻辑）

## 4. 内置工具集 — Canvas

- [x] 4.1 实现 `agents/base/tools/builtin/canvas_tools.py`：`canvas_add_chart`、`canvas_add_text`、`canvas_add_image`、`canvas_remove_node`、`canvas_update_node` 工具函数，内部通过回调 yield `AgentToolCall` 事件
- [x] 4.2 创建 `agents/base/tools/builtin/__init__.py`，提供各类工具的 `register_*_tools(registry)` 便捷函数

## 5. 内置工具集 — 股票行情

- [x] 5.1 实现 `agents/base/tools/builtin/stock_tools.py`：`get_stock_quote(codes)` 调用 `GET /api/stocks/quote`，返回格式化行情数据
- [x] 5.2 实现 `get_stock_kline(code, period, days)` 调用 `GET /api/stocks/kline`，返回格式化 K 线数据
- [x] 5.3 实现 API 调用错误处理：超时/不可用时返回错误字符串

## 6. 内置工具集 — PDF 读取

- [x] 6.1 在 `agents/requirements.txt` 中添加 `pdfplumber>=0.10.0` 和 `requests>=2.31.0` 依赖
- [x] 6.2 实现 `agents/base/tools/builtin/pdf_tools.py`：`read_uploaded_pdf(file_id)` 通过 `PlatformAPIClient` 下载 PDF 文件，使用 `pdfplumber` 提取文本
- [x] 6.3 实现表格提取：检测 PDF 页面中的表格，输出为 markdown 表格格式
- [x] 6.4 实现文本截断：超过 50,000 字符时截断并附加提示
- [x] 6.5 处理异常情况：扫描版 PDF 无文本时返回明确提示

## 7. 内置工具集 — 网页搜索与抓取

- [x] 7.1 在 `agents/requirements.txt` 中添加 `beautifulsoup4>=4.12.0` 依赖
- [x] 7.2 实现 `agents/base/tools/builtin/web_tools.py`：`search_web(query)` 执行网页搜索，返回标题/URL/摘要列表
- [x] 7.3 实现 `fetch_webpage(url, extract)` 抓取网页并清洗 HTML，提取主要文本内容，支持 `extract="main"` 模式提取正文
- [x] 7.4 实现请求超时（默认 15s）和错误处理：不可达/非 200 状态码返回错误字符串
- [x] 7.5 实现内容长度限制：超过配置最大长度时截断

## 8. 内置工具集 — 公司财报

- [x] 8.1 实现 `agents/base/tools/builtin/financial_tools.py`：`fetch_financial_report(stock_code, report_type)` 从公开财经数据源（东方财富/巨潮资讯）抓取结构化财务数据
- [x] 8.2 实现 `report_type="summary"` 模式：获取关键财务指标（营收、净利、PE、ROE、资产负债率等）
- [x] 8.3 实现 `report_type="income"` 模式：获取利润表数据（营收明细、成本、毛利率、营业利润等）
- [x] 8.4 实现数据格式化：将财务数据整理为 LLM 易读的结构化文本
- [x] 8.5 实现数据源异常处理：不可用时返回错误字符串

## 9. ToolCallableAgent 基类

- [x] 9.1 创建 `agents/base/tool_callable_agent.py`：`ToolCallableAgent(BaseAgent)` 类，持有 `ToolRegistry` 和 LLM client
- [x] 9.2 实现 streaming LLM client 封装：使用 `openai` SDK 的 `chat.completions.create(stream=True, tools=...)` ，支持环境变量配置（`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`，fallback `DEEPSEEK_API_KEY`）
- [x] 9.3 实现 tool execution loop：LLM 响应 → 检测 tool_calls → execute tools → 追加 tool messages → 再次调用 LLM，循环直到纯文本响应
- [x] 9.4 实现流式 token 输出：每次 LLM 调用内逐 token yield `AgentChunk`
- [x] 9.5 实现进度事件发射：tool 执行前 yield `AgentToolStart`，执行后 yield `AgentToolResult`（用户可见）
- [x] 9.6 实现最大循环次数限制（默认 10），超限 yield `AgentError(code="TOOL_LOOP_LIMIT")`
- [x] 9.7 实现 API 错误处理：超时、认证失败、速率限制等情况 yield `AgentError`

## 10. Supervisor Agent（Plan-Execute-Check）

- [x] 10.1 创建 `agents/supervisor_agent/config.yaml`（name、display_name、description、entry_point）
- [x] 10.2 创建 `agents/supervisor_agent/agent.py`：`SupervisorAgent(ToolCallableAgent)` 类，实现 PEC 循环主逻辑
- [x] 10.3 实现子 agent 注册表（`sub_agents.py`）：定义可用子 agent 列表及其能力描述（名称、类引用、能力摘要）
- [x] 10.4 实现 Plan 阶段：LLM 根据用户请求和子 agent 能力描述生成结构化执行计划，yield `AgentPlan` 事件（用户可见）
- [x] 10.5 实现 Execute 阶段：`delegate_to_agent(agent_name, task_description)` 工具函数——进程内实例化子 agent、构建 `AgentRequest`、收集输出并转发 chunk/tool_call 事件、yield `AgentDelegate` + `AgentDelegateResult` 事件
- [x] 10.6 实现 Check 阶段：LLM 评审执行结果是否满足用户请求，yield `AgentCheck` 事件（用户可见），不满足则回到 Plan 阶段
- [x] 10.7 实现 PEC 最大迭代次数限制（默认 3 次），超限后以当前最佳结果输出
- [x] 10.8 实现 Supervisor prompt 模板（`prompts.py`）：分别定义 plan/execute/check 三个阶段的 prompt，包含子 agent 能力列表
- [x] 10.9 实现简单请求直接回复逻辑：问候、闲聊等不进入 PEC 循环
- [x] 10.10 处理未知 agent_name 的错误情况：返回可用 agent 列表提示 LLM 重试

## 11. 专业子 Agent

- [x] 11.1 创建 `agents/pharma_analyst/agent.py`：`PharmaAnalystAgent(ToolCallableAgent)`，注册 `search_web`、`read_uploaded_pdf`、`fetch_financial_report`、`canvas_add_text` 工具
- [x] 11.2 创建 `agents/pharma_analyst/prompts.py`：医药分析角色定义、药物管线评估框架、研报解读指引
- [x] 11.3 创建 `agents/pharma_analyst/tools.py`：注册内置工具 + 医药领域专用工具（如药物数据库查询）
- [x] 11.4 创建 `agents/stock_analyst/agent.py`：`StockAnalystAgent(ToolCallableAgent)`，注册 `get_stock_quote`、`get_stock_kline`、`fetch_financial_report`、`canvas_add_chart`、`canvas_add_text` 工具
- [x] 11.5 创建 `agents/stock_analyst/prompts.py`：股票分析角色定义、技术分析框架、财报解读指引
- [x] 11.6 创建 `agents/stock_analyst/tools.py`：注册 stock + canvas + financial 内置工具
- [x] 11.7 创建 `agents/investment_advisor/agent.py`：`InvestmentAdvisorAgent(ToolCallableAgent)`，注册全部内置工具
- [x] 11.8 创建 `agents/investment_advisor/prompts.py`：投资顾问角色定义、多数据源综合分析框架
- [x] 11.9 创建 `agents/investment_advisor/tools.py`：注册全部内置工具

## 12. TS 层适配

- [x] 12.1 更新 `src/app/api/chat/route.ts`：对 `tool_start`、`tool_result`、`plan`、`check`、`agent_delegate`、`agent_result` 事件类型透传（不拦截执行），保留旧 `tool_call` 拦截逻辑
- [x] 12.2 更新 `src/lib/agents/types.ts`：为新事件类型添加 TypeScript 接口定义
- [x] 12.3 更新 `src/hooks/use-chat-stream.ts`：识别新事件类型，通过 callback 将 `tool_start`/`tool_result`/`plan`/`check`/`agent_delegate`/`agent_result` 传递给 UI 层
- [x] 12.4 更新 `src/lib/agents/executor.ts`：注入 `PLATFORM_API_BASE` 环境变量
- [x] 12.5 更新 `.env.example`：添加 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`、`PLATFORM_API_BASE` 可选变量说明

## 13. 集成验证

- [ ] 13.1 手动测试：选择 supervisor_agent，发送医药分析问题，验证 Plan→Execute(pharma_analyst)→Check 完整流程
- [ ] 13.2 手动测试：发送跨领域问题（如"恒瑞医药的管线和股价"），验证多步 Plan 执行多个子 agent
- [ ] 13.3 手动测试：发送简单问候，验证 Supervisor 直接回复（不进入 PEC 循环）
- [ ] 13.4 手动测试：验证股票工具——发送"查询600276行情"，确认 tool_start/tool_result 对用户可见且数据正确
- [ ] 13.5 手动测试：验证 PDF 工具——上传 PDF 后让 agent 解读内容，确认文本提取和分析正常
- [ ] 13.6 手动测试：验证网页抓取——让 agent 查找某公司最新财报信息，确认 web 搜索和内容提取正常
- [ ] 13.7 手动测试：验证财报工具——让 agent 分析某公司财务状况，确认财务数据获取和格式化正常
- [ ] 13.8 手动测试：验证 Canvas 工具——确认 agent 自主添加图表和文本节点到画布
- [ ] 13.9 手动测试：验证旧 pharma_agent 仍然正常工作（向后兼容）
- [ ] 13.10 手动测试：设置无效 API key，验证友好错误提示
- [ ] 13.11 手动测试：触发 Check 不通过场景，验证 re-plan 迭代逻辑
