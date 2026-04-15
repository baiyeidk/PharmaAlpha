## ADDED Requirements

### Requirement: 文档摄入——解析与分块

系统 SHALL 支持 PDF、网页 URL、纯文本三种来源的文档摄入。解析后 MUST 使用递归分块策略（段落 → 句子 → 字符），chunk_size=512 tokens，overlap=64 tokens。每个 chunk MUST 保留源文档元数据（页码、来源 URL、文档类型）。

#### Scenario: PDF 文档摄入
- **WHEN** 用户上传一个 20 页的研报 PDF
- **THEN** 系统使用 pdfplumber 解析文本，递归分块，生成 N 个 DocumentChunk（每个约 512 tokens），每个 chunk 记录所在页码

#### Scenario: 网页 URL 摄入
- **WHEN** 用户提交一个财经新闻 URL
- **THEN** 系统使用 BeautifulSoup 抓取正文内容，去除 HTML 标签和导航栏，递归分块存储

#### Scenario: 重复文档去重
- **WHEN** 用户上传与已有文档 fileHash 相同的 PDF
- **THEN** 系统返回"文档已存在"，不重复摄入

### Requirement: 文档 Embedding 存储

每个 DocumentChunk MUST 生成 embedding 向量并存入 pgvector。Embedding 生成 SHALL 使用与记忆系统共享的 `EmbeddingProvider`。批量 embedding 时 MUST 控制单次 API 调用不超过 100 条文本。

#### Scenario: 批量 embedding 写入
- **WHEN** 一篇文档被分为 50 个 chunks
- **THEN** 系统批量调用 embedding API（单批 <= 100 条），将所有 chunk 的向量写入 DocumentChunk.embedding 字段

#### Scenario: embedding 部分失败
- **WHEN** 批量 embedding 中有部分 chunk 失败
- **THEN** 成功的 chunk 正常写入，失败的 chunk embedding 置 null，Document 状态设为 "ready"（部分可检索）

### Requirement: Document 生命周期管理

Document 模型 MUST 维护 status 字段：pending → processing → ready | error。系统 SHALL 支持删除文档及其所有 chunks（级联删除）。

#### Scenario: 正常摄入流程
- **WHEN** 文档开始摄入
- **THEN** status 从 "pending" → "processing"（解析分块中）→ "ready"（embedding 完成）

#### Scenario: 摄入失败
- **WHEN** PDF 解析或 embedding 过程抛出异常
- **THEN** status 设为 "error"，Document.metadata 记录错误信息

#### Scenario: 删除文档
- **WHEN** 调用 DELETE /api/rag/documents/:id
- **THEN** 该 Document 及其所有 DocumentChunk（含 embedding 向量）被级联删除

### Requirement: RAG 向量检索 Tool

系统 SHALL 提供 `rag.search` tool 注册到 PEC Agent 的 tool registry。该 tool 接受 query 字符串和可选 top_k / doc_type 参数，返回最相关的文档片段。

#### Scenario: 基本检索
- **WHEN** PEC Agent 在 execute 阶段调用 `rag.search(query="恒瑞医药 2024年报 营收", top_k=5)`
- **THEN** 返回最多 5 个 DocumentChunk，按向量余弦相似度排序，每个包含 content + metadata

#### Scenario: 按文档类型过滤
- **WHEN** 调用 `rag.search(query="...", doc_type="pdf")`
- **THEN** 仅在 sourceType="pdf" 的文档 chunks 中检索

#### Scenario: 知识库为空
- **WHEN** 调用 `rag.search` 但 DocumentChunk 表为空
- **THEN** 返回空数组，不报错

### Requirement: RAG 文档摄入 Tool

系统 SHALL 提供 `rag.ingest` tool 注册到 PEC Agent 的 tool registry。该 tool 接受 URL 或文件路径，触发文档摄入管线。

#### Scenario: Agent 主动摄入网页
- **WHEN** PEC Agent 在分析中发现需要某份研报，调用 `rag.ingest(url="https://example.com/report.pdf")`
- **THEN** 系统下载文档、解析、分块、embedding、存储，返回 Document id 和 chunk 数量

#### Scenario: 摄入超时
- **WHEN** 文档解析 + embedding 总耗时超过 120 秒
- **THEN** 返回超时错误，Document status 设为 "error"

### Requirement: 文档管理 API

系统 SHALL 提供以下 Next.js API routes，供前端和调试使用：
- `POST /api/rag/ingest` — 上传文档文件或提交 URL
- `GET /api/rag/documents` — 列出当前用户的已索引文档（分页）
- `DELETE /api/rag/documents/:id` — 删除指定文档
- `POST /api/rag/search` — 直接执行向量检索（调试用）

所有 API MUST 验证用户身份（getSession）。

#### Scenario: 上传 PDF 文档
- **WHEN** POST /api/rag/ingest 携带 multipart/form-data PDF 文件
- **THEN** 返回 `{ documentId, status: "processing" }`，后台异步完成摄入

#### Scenario: 列出已索引文档
- **WHEN** GET /api/rag/documents
- **THEN** 返回当前用户的文档列表，每个包含 id, title, sourceType, status, chunkCount, createdAt

#### Scenario: 未认证访问
- **WHEN** 未登录用户访问任何 /api/rag/* 路由
- **THEN** 返回 401 Unauthorized

### Requirement: 检索结果格式

`rag.search` 返回的每个结果 MUST 包含：content（chunk 文本）、score（相似度分数 0-1）、metadata（页码/来源/文档标题）。结果 MUST 按 score 降序排列。

#### Scenario: 结果格式验证
- **WHEN** `rag.search` 返回结果
- **THEN** 每个结果对象包含 `{ content: string, score: number, metadata: { page?: number, sourceUrl?: string, docTitle: string, docType: string } }`
