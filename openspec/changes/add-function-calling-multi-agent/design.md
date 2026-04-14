## Context

PharmaAlpha 的 agent 系统使用 CLI JSON Lines 协议：Python agent 通过 stdin 接收请求、stdout 输出 JSON 行（chunk/tool_call/result/error），Node `executor.ts` 负责 spawn 进程并将输出转为 SSE 流。

当前工具调用机制：
- Canvas 工具通过 system prompt 描述注入 → LLM 在文本中嵌入 `{"type":"tool_call",...}` JSON 行 → 服务端正则提取执行
- 缺陷：正则 `\{[^}]*\}` 无法处理嵌套 JSON；LLM 不知道工具执行结果，无法基于结果推理
- `employee_investment_team` 使用 LangGraph 实现工作流图，但这是编排层而非 LLM 原生 tool use

目标架构需要在保持现有协议兼容性的同时，引入两个层次的升级：
1. **Agent 内部**：LLM 原生 function calling + tool execution loop，工具执行结果对用户全程可见
2. **Agent 之间**：Plan-Execute-Check 循环——Supervisor 先规划、再执行、后检查，必要时迭代

## Goals / Non-Goals

**Goals:**
- 实现 LLM 原生 function calling（OpenAI `tools` 参数），agent 内部完成 tool-use loop（LLM → tool_calls → execute → results → LLM）
- 提供声明式工具注册机制，自动生成 function calling schema
- 引入 Supervisor Agent 的 Plan-Execute-Check 循环，实现多 agent 任务规划、执行和结果验证
- 保持向后兼容：旧 agent（pharma_agent）无需修改即可继续运行
- 流式输出全程保持——tool loop 的每一步对用户可见

**Non-Goals:**
- 不替换 `employee_investment_team` 的 LangGraph 编排（两者共存，解决不同问题）
- 不实现 agent 跨进程/跨网络通信（当前阶段 Supervisor 在同一 Python 进程内调用子 agent）
- 不引入消息队列或 agent 运行时框架（如 AutoGen、CrewAI）
- 不修改前端 SSE 消费逻辑（前端已能处理 chunk/tool_call/result）
- 不实现工具结果的持久化存储

## Decisions

### 1. Function Calling 策略：OpenAI SDK 原生 `tools` 参数

**选择**：使用 `openai` SDK 的 `tools` 参数传递工具 schema，解析响应中的 `tool_calls` 字段，而非从文本中正则提取。

**替代方案**：
- (A) 保持 system prompt + 文本提取 → 格式脆弱，无法回传工具结果
- (B) 使用 LangChain Tool abstraction → 重依赖，项目已选择轻量路线

**理由**：DeepSeek API 兼容 OpenAI function calling 协议（`tools` + `tool_choice`），直接利用模型的结构化输出能力比文本提取可靠得多。同时 OpenAI/Anthropic/Qwen 等主流模型都支持此协议，切换成本极低。

### 2. Tool Execution Loop 架构

**选择**：在 `ToolCallableAgent`（新基类，继承 `BaseAgent`）中实现循环：

```
messages = [system_prompt, ...user_messages]
while True:
    response = llm.chat(messages, tools=tool_schemas, stream=True)
    
    if response has tool_calls:
        for each tool_call:
            yield AgentToolStart(name, args)     # 通知前端：开始执行
            result = tool_registry.execute(tool_call)
            yield AgentToolResult(name, result)  # 通知前端：执行结果（用户可见）
            messages.append(assistant_msg_with_tool_calls)
            messages.append(tool_result_msg)
        continue  # 继续让 LLM 处理工具结果
    
    else:  # 纯文本响应
        yield AgentChunk(token) for each streaming token
        yield AgentResult(full_content)
        break
```

**替代方案**：
- (A) 服务端（Node）执行工具并回传 → 需要多次 agent 启停，协议改动大
- (B) 每次工具调用作为独立请求 → 丢失上下文，需要状态管理

**理由**：Agent 进程内闭环最简单——一次 spawn，所有 tool loop 在进程生命周期内完成。流式 token 和 tool_call 事件通过现有 stdout JSON Lines 持续输出，前端实时可见。

### 3. Tool Registry 设计：装饰器 + 自动 Schema 生成

**选择**：提供 `@tool` 装饰器，从函数签名和 docstring 自动生成 OpenAI function schema：

```python
from base.tools import tool, ToolRegistry

registry = ToolRegistry()

@registry.register
@tool(description="查询A股股票实时行情")
def get_stock_quote(ticker: str, period: str = "1d") -> dict:
    """ticker: A股代码如600276; period: 时间周期(1d/1w/1m)"""
    ...
```

自动生成：
```json
{
  "type": "function",
  "function": {
    "name": "get_stock_quote",
    "description": "查询A股股票实时行情",
    "parameters": {
      "type": "object",
      "properties": {
        "ticker": {"type": "string", "description": "A股代码如600276"},
        "period": {"type": "string", "description": "时间周期(1d/1w/1m)"}
      },
      "required": ["ticker"]
    }
  }
}
```

**替代方案**：
- (A) 手写 JSON schema → 维护负担重，与实现容易不一致
- (B) Pydantic model 作为 schema → 过重，简单工具不需要

**理由**：装饰器模式是 Python 生态主流（LangChain、Instructor 等都如此），开发体验最好。类型注解 + docstring 足够推导 schema。

### 4. 多 Agent 协作：Plan-Execute-Check 循环

**选择**：引入 `SupervisorAgent`，采用 Plan-Execute-Check（PEC）循环模式而非简单路由。Supervisor 的每次请求处理都经过三个显式阶段：

```
┌─────────────────────────────────────────────────────┐
│                 Plan-Execute-Check Loop              │
│                                                     │
│  ┌──────┐    ┌─────────┐    ┌───────┐              │
│  │ Plan │───→│ Execute │───→│ Check │──→ 满意? ──→ 输出结果
│  └──────┘    └─────────┘    └───────┘              │
│      ↑                          │                   │
│      └──────── 不满意/需补充 ────┘                   │
│                                                     │
└─────────────────────────────────────────────────────┘

Phase 1 - Plan（规划）:
  Supervisor LLM 分析用户意图，生成结构化执行计划:
  - 需要调用哪些子 agent？（可多个）
  - 每个子 agent 的具体任务描述
  - 执行顺序和依赖关系
  - 预期产出和成功标准
  → yield AgentPlan 事件（用户可见当前计划）

Phase 2 - Execute（执行）:
  按计划逐步委派子 agent:
  - 通过 function calling 调用 delegate_to_agent(agent_name, task)
  - 子 agent 同进程内执行，chunk/tool_call 实时转发
  - 收集每个子 agent 的执行结果
  → yield AgentDelegate + AgentDelegateResult 事件

Phase 3 - Check（检查）:
  LLM 评审所有执行结果:
  - 结果是否满足原始需求？
  - 是否有遗漏或矛盾？
  - 是否需要补充执行？
  若不满足 → 回到 Plan 阶段，生成补充计划
  若满足 → 合成最终回复，yield AgentResult
  → yield AgentCheck 事件（用户可见评审结论）
```

具体实现为 Supervisor 的三个 tool：
```python
tools = [
    create_plan(user_request) -> Plan,       # Phase 1: 生成执行计划
    delegate_to_agent(agent_name, task) -> str, # Phase 2: 委派子 agent
    check_results(plan, results) -> CheckResult, # Phase 3: 评审结果
]
```

**替代方案**：
- (A) 简单路由（LLM 直接选 agent 执行）→ 无法处理多步骤请求，无结果验证，质量不可控
- (B) 固定 DAG 编排（类似 employee_investment_team 的 LangGraph）→ 适合固定工作流，不适合动态用户请求
- (C) ReAct 单循环 → 无显式规划阶段，每步决策缺乏全局视角

**理由**：PEC 模式的核心优势：
1. **Plan 阶段**让 LLM 先思考全局策略，避免逐步试探的低效
2. **Check 阶段**提供质量保障，不满意可以迭代
3. 每个阶段的输出对用户可见，用户能看到 agent 的"思考过程"
4. 自然支持多 agent 并行/串行委派——Plan 中定义依赖关系即可

### 5. 内置工具集架构：Python agent 通过 HTTP 调用平台 API + 本地处理

Agent 的工具分为两类：**平台 API 桥接工具**（Python 通过 HTTP 调用 Next.js 已有的 API）和**本地处理工具**（Python 进程内直接处理）。

#### 5a. 平台 API 桥接工具

这些工具通过 HTTP 调用 Next.js 已有的 API 端点，由 `executor.ts` 注入的环境变量提供 base URL：

| 工具 | 调用目标 | 用途 |
|------|---------|------|
| `get_stock_quote` | `GET /api/stocks/quote?codes=...` | 获取实时行情（价格、涨跌幅、成交量） |
| `get_stock_kline` | `GET /api/stocks/kline?code=...&period=...&days=...` | 获取 K 线历史数据（OHLCV） |
| `read_uploaded_pdf` | `GET /api/files/{fileId}` | 下载已上传的 PDF 文件，本地提取文本 |
| `canvas_*` | `POST /api/canvas/{convId}/actions` | Canvas 节点操作（已有 `CanvasAPI`） |

**设计原则**：Python agent 不直接访问数据库或第三方 API（Sina 等），而是统一通过 Next.js API 层。这保持了单一数据入口、统一鉴权和缓存策略。

#### 5b. 本地处理工具

这些工具在 Python 进程内直接执行，不依赖外部 API：

| 工具 | Python 依赖 | 用途 |
|------|------------|------|
| `extract_pdf_text` | `pdfplumber` | 从 PDF 文件提取文本内容（表格、段落） |
| `search_web` | `requests` + `beautifulsoup4` | 搜索/抓取网页获取公司财报、新闻等公开信息 |
| `fetch_financial_report` | `requests` + `beautifulsoup4` | 从东方财富/巨潮资讯等抓取指定公司的财务数据摘要 |
| `analyze_financial_data` | 内置 | 对获取的财务数据进行格式化整理、关键指标计算 |

**选择 `pdfplumber` 而非 `PyPDF2`**：pdfplumber 对表格提取支持更好，医药/财报 PDF 通常包含大量表格数据。

**Web 搜索策略**：V1 使用直接 HTTP 抓取公开财经网站（东方财富、巨潮资讯等）的结构化页面。后续可接入搜索引擎 API（如 SerpAPI、Bing Search）。

#### 5c. 工具与子 Agent 的绑定

| 子 Agent | 工具集 |
|----------|--------|
| `PharmaAnalystAgent` | `search_web`、`fetch_financial_report`、`read_uploaded_pdf`、`canvas_add_text` |
| `StockAnalystAgent` | `get_stock_quote`、`get_stock_kline`、`canvas_add_chart`、`canvas_add_text`、`fetch_financial_report` |
| `InvestmentAdvisorAgent` | 全部工具（综合分析需要跨领域数据） |

### 6. 子 Agent 粒度：按领域拆分

**选择**：将现有 `pharma_agent` 的功能拆分为多个专业子 agent：
- `PharmaAnalystAgent`：医药行业分析、药物信息、研报/PDF 解读
- `StockAnalystAgent`：股票行情查询、K线分析、Canvas 图表可视化、公司财报检索
- `InvestmentAdvisorAgent`：投资策略综合建议、多数据源交叉分析

**理由**：每个子 agent 拥有独立的工具集和 system prompt，避免单个 agent 承担过多职责。Supervisor 按用户意图选择合适的子 agent。每个子 agent 只注册自己需要的工具，LLM 的 function calling 决策更精准。

### 7. 协议扩展：增量兼容，全程用户可见

**选择**：JSON Lines 协议新增事件类型，所有事件对用户可见。工具执行结果和 PEC 各阶段进展全部通过事件流推送到前端：

| 新增类型 | 用途 | 用户可见内容 |
|---------|------|-------------|
| `tool_start` | 开始执行工具 | "正在查询 600276 行情..." |
| `tool_result` | 工具执行结果 | 结构化的工具返回数据 |
| `plan` | Supervisor 生成执行计划 | 计划步骤列表 |
| `agent_delegate` | 委派子 agent | "正在请求医药分析师分析..." |
| `agent_result` | 子 agent 返回结果 | 子 agent 的分析结论 |
| `check` | 检查/评审结果 | 评审结论和后续行动 |

**设计原则**：工具和 agent 的执行不是"黑箱"——用户应该能看到 agent 在做什么、得到了什么结果、如何评判。这增强用户信任感，也方便调试。

旧 agent 仍然只输出 `chunk/tool_call/result/error`，前端遇到未知类型按可忽略处理。

### 8. 项目结构

```
agents/
  base/
    tools/
      __init__.py
      registry.py              # ToolRegistry + @tool decorator
      schema.py                # 类型注解 → OpenAI schema 转换
      builtin/
        __init__.py
        canvas_tools.py        # Canvas 操作工具（复用现有 CanvasAPI + protocol helpers）
        stock_tools.py         # 股票行情/K线工具（调用 /api/stocks/* 端点）
        pdf_tools.py           # PDF 文本提取工具（pdfplumber）
        web_tools.py           # 网页搜索/抓取工具（requests + beautifulsoup4）
        financial_tools.py     # 公司财报检索工具（东方财富/巨潮资讯结构化抓取）
    tool_callable_agent.py     # 支持 function calling + tool loop 的 BaseAgent 子类
    protocol.py                # 扩展：新增 AgentToolStart, AgentToolResult, AgentPlan, AgentCheck 等
    platform_api.py            # 平台 API 客户端（统一 HTTP 调用 Next.js 端点）
  
  supervisor_agent/
    config.yaml
    agent.py                   # SupervisorAgent(ToolCallableAgent) — PEC 循环
    sub_agents.py              # 子 agent 注册表（名称、类、能力描述）
    prompts.py                 # PEC 各阶段 prompt（plan/execute/check）
  
  pharma_analyst/              # 子 agent（非独立注册，由 Supervisor 内部调用）
    agent.py
    tools.py                   # search_web, read_pdf, fetch_financial_report, canvas_add_text
    prompts.py
  
  stock_analyst/               # 子 agent
    agent.py
    tools.py                   # get_stock_quote, get_stock_kline, canvas_add_chart, fetch_financial_report
    prompts.py
  
  investment_advisor/          # 子 agent
    agent.py
    tools.py                   # 全部工具
    prompts.py
```

## Risks / Trade-offs

- **[DeepSeek function calling 质量]** → DeepSeek 的 function calling 可能不如 GPT-4 稳定；添加 fallback 到 system prompt 模式作为降级策略。通过 few-shot 示例和严格的 tool schema 约束提高成功率
- **[Tool loop 无限循环]** → 设置最大循环次数（默认 10 次），超过后强制终止并 yield AgentError
- **[同进程子 agent 内存开销]** → 子 agent 是轻量 Python 对象，非独立进程，内存开销可控。每次请求实例化、处理完释放
- **[Plan 质量与 Check 循环次数]** → Plan 可能遗漏步骤或 Check 反复不通过；设置最大 PEC 迭代次数（默认 3），超限后以当前最佳结果回复并附带说明
- **[流式输出延迟]** → Tool loop 的每一步都有 LLM 调用延迟；通过 `tool_start` 事件让用户知道 agent 正在工作，避免"卡住"感
- **[协议向后兼容]** → 新事件类型为增量添加，前端 `use-chat-stream.ts` 遇到未知 type 会忽略；现有 agent 无需修改
- **[网页抓取稳定性]** → 财经网站页面结构可能变化导致解析失败；工具返回错误信息让 LLM 降级处理，同时使用结构化 API 优先于 HTML 解析
- **[PDF 解析质量]** → 扫描版 PDF 无法提取文本；V1 仅支持文本型 PDF，返回明确提示；后续可接入 OCR
- **[平台 API 调用延迟]** → Python agent 通过 HTTP 调用 Next.js API 增加一跳延迟；通过 localhost 调用（同机），延迟可控在 10-50ms

## Resolved Decisions

- **子 agent 注册**：子 agent 不独立注册 `config.yaml`，仅作为 Supervisor 的内部实现。用户只选择 Supervisor，由 Supervisor 决定调用哪些子 agent。
- **工具执行结果可见性**：**所有工具执行结果对用户可见**。`tool_result` 事件包含结构化结果数据，前端渲染为可折叠的结果卡片。这增强透明度和用户信任。
- **多 agent 调用模式**：V1 支持**串行**委派（Plan 中定义顺序）。Plan 阶段的结构天然支持后续扩展为并行执行。
