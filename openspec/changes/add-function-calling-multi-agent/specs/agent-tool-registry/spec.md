## ADDED Requirements

### Requirement: Declarative tool registration via decorator
Agent developers SHALL register tools using a `@tool` decorator that captures the function's name, description, and parameter schema for automatic OpenAI function calling schema generation.

#### Scenario: Register a simple tool
- **WHEN** developer decorates a function with `@tool(description="...")` and registers it with `ToolRegistry`
- **THEN** `registry.get_schemas()` returns an OpenAI-compatible tool schema with the function's name, description, and parameters derived from type annotations

#### Scenario: Tool with optional parameters
- **WHEN** a tool function has parameters with default values (e.g., `period: str = "1d"`)
- **THEN** the generated schema marks those parameters as optional (not in `required` array) and includes the default value in the description

### Requirement: Auto schema generation from type annotations
`ToolRegistry` SHALL generate OpenAI function calling schemas automatically from Python type annotations and docstring parameter descriptions.

#### Scenario: String parameter type
- **WHEN** a tool parameter is annotated as `str`
- **THEN** the schema property has `"type": "string"`

#### Scenario: Integer parameter type
- **WHEN** a tool parameter is annotated as `int`
- **THEN** the schema property has `"type": "integer"`

#### Scenario: List parameter type
- **WHEN** a tool parameter is annotated as `list[str]`
- **THEN** the schema property has `"type": "array"` with `"items": {"type": "string"}`

#### Scenario: Parameter descriptions from docstring
- **WHEN** a tool function's docstring contains `param_name: description text` lines
- **THEN** each parameter's schema includes the corresponding description

### Requirement: Tool execution by name
`ToolRegistry` SHALL execute a registered tool by name with JSON-parsed arguments, returning the result as a string.

#### Scenario: Execute a registered tool
- **WHEN** `registry.execute("get_stock_quote", {"ticker": "600276"})` is called
- **THEN** the registered `get_stock_quote` function is called with `ticker="600276"` and its return value is serialized to string

#### Scenario: Execute an unregistered tool
- **WHEN** `registry.execute("nonexistent_tool", {})` is called
- **THEN** a `ToolNotFoundError` is raised with the tool name

#### Scenario: Tool execution raises an exception
- **WHEN** a registered tool's function raises an exception during execution
- **THEN** `registry.execute()` returns an error string describing the failure instead of propagating the exception

### Requirement: Built-in canvas tools
`ToolRegistry` SHALL provide pre-built canvas tool implementations that wrap the existing `AgentToolCall` protocol helpers, allowing function-calling agents to manipulate the canvas.

#### Scenario: Canvas add chart tool
- **WHEN** LLM calls `canvas_add_chart` with `{"label": "恒瑞医药走势", "tickers": ["600276"]}`
- **THEN** the tool yields an `AgentToolCall.canvas_add_chart(...)` event AND returns a confirmation string as the tool result for the LLM

#### Scenario: Canvas add text tool
- **WHEN** LLM calls `canvas_add_text` with `{"label": "分析摘要", "content": "..."}`
- **THEN** the tool yields an `AgentToolCall.canvas_add_text(...)` event AND returns a confirmation string

### Requirement: Built-in stock query tools
`ToolRegistry` SHALL provide pre-built stock query tool implementations that call the platform's Next.js stock API endpoints via HTTP.

#### Scenario: Stock quote query
- **WHEN** LLM calls `get_stock_quote` with `{"codes": "600276,300760"}`
- **THEN** the tool calls `GET /api/stocks/quote?codes=600276,300760` and returns formatted quote data (name, price, change percent, volume, amount) as a string

#### Scenario: Stock kline query
- **WHEN** LLM calls `get_stock_kline` with `{"code": "600276", "period": "daily", "days": 30}`
- **THEN** the tool calls `GET /api/stocks/kline?code=600276&period=daily&days=30` and returns formatted OHLCV historical data as a string

#### Scenario: Stock API unavailable
- **WHEN** the platform stock API returns an error or times out
- **THEN** the tool returns an error string describing the failure, allowing the LLM to inform the user

### Requirement: Built-in PDF text extraction tools
`ToolRegistry` SHALL provide a pre-built PDF reading tool that extracts text content from PDF files, supporting both uploaded files (via platform file API) and local file paths.

#### Scenario: Extract text from uploaded PDF by file ID
- **WHEN** LLM calls `read_uploaded_pdf` with `{"file_id": "clxxx..."}`
- **THEN** the tool downloads the PDF from `GET /api/files/{file_id}`, extracts text using `pdfplumber`, and returns the text content as a string

#### Scenario: PDF contains tables
- **WHEN** the PDF contains tabular data (e.g. financial statements)
- **THEN** the tool extracts tables as formatted text (pipe-separated or markdown table format) preserving structure

#### Scenario: Scanned/image-only PDF
- **WHEN** the PDF contains only images with no extractable text
- **THEN** the tool returns a clear message indicating that text extraction failed and OCR is not currently supported

#### Scenario: PDF too large
- **WHEN** the extracted text exceeds a configured maximum length (default 50,000 characters)
- **THEN** the tool truncates the text and appends a note indicating truncation, returning the first portion

### Requirement: Built-in web search and scraping tools
`ToolRegistry` SHALL provide tools for searching the web and extracting content from web pages, enabling agents to gather public information about companies and drugs.

#### Scenario: Search the web for a topic
- **WHEN** LLM calls `search_web` with `{"query": "恒瑞医药 2025年财报"}`
- **THEN** the tool performs a web search and returns a list of relevant results with titles, URLs, and snippets

#### Scenario: Fetch and extract content from a URL
- **WHEN** LLM calls `fetch_webpage` with `{"url": "https://..."}`
- **THEN** the tool fetches the page, strips HTML tags, and returns cleaned text content (limited to a configured max length)

#### Scenario: Target URL is unreachable
- **WHEN** the target URL returns a non-2xx status or times out
- **THEN** the tool returns an error string describing the failure

#### Scenario: Fetch with content extraction focus
- **WHEN** LLM calls `fetch_webpage` with `{"url": "...", "extract": "main"}` 
- **THEN** the tool attempts to extract the main article content (stripping navigation, ads, sidebars) and returns clean text

### Requirement: Built-in financial report tools
`ToolRegistry` SHALL provide tools for retrieving structured financial data about publicly listed companies from public financial data sources.

#### Scenario: Fetch company financial summary
- **WHEN** LLM calls `fetch_financial_report` with `{"stock_code": "600276", "report_type": "summary"}`
- **THEN** the tool fetches key financial metrics (revenue, net profit, PE ratio, ROE, debt ratio) from a public financial data source and returns formatted data

#### Scenario: Fetch income statement
- **WHEN** LLM calls `fetch_financial_report` with `{"stock_code": "600276", "report_type": "income"}`
- **THEN** the tool fetches income statement data (revenue breakdown, cost, gross margin, operating profit) and returns formatted data

#### Scenario: Financial data source unavailable
- **WHEN** the financial data source is unreachable or returns an error
- **THEN** the tool returns an error string and the LLM can suggest the user try again later or use alternative data

### Requirement: Platform API client for Python agents
A `PlatformAPIClient` SHALL provide a unified HTTP client for Python agents to call Next.js API endpoints, handling base URL resolution and authentication.

#### Scenario: API client initialization
- **WHEN** a Python agent creates a `PlatformAPIClient` instance
- **THEN** the client reads `PLATFORM_API_BASE` (default `http://localhost:3000/api`) and `AGENT_API_KEY` from environment variables

#### Scenario: Authenticated API call
- **WHEN** a tool calls `client.get("/stocks/quote", params={"codes": "600276"})`
- **THEN** the client sends `GET {base}/stocks/quote?codes=600276` with `Authorization: Bearer {AGENT_API_KEY}` header and returns parsed JSON
