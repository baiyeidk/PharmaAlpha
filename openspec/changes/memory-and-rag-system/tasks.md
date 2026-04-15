## 1. 基础设施——pgvector + Prisma Schema

- [x] 1.1 安装 pgvector 扩展：执行 `CREATE EXTENSION IF NOT EXISTS vector;`，添加启动时健康检查脚本
- [x] 1.2 新增 Prisma 模型：MemoryNode, MemoryEdge, ConversationSummary（含 `Unsupported("vector(1536)")` 字段）
- [x] 1.3 新增 Prisma 模型：Document, DocumentChunk（含 embedding 向量字段）
- [x] 1.4 执行 `prisma db push` 应用 schema 变更，验证 vector 列正确创建
- [x] 1.5 在 User 模型中添加 `memoryNodes MemoryNode[]` relation
- [x] 1.6 新增环境变量到 `.env.example`：EMBEDDING_PROVIDER, EMBEDDING_API_KEY, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS

## 2. Embedding 服务——Python 端

- [x] 2.1 创建 `agents/base/embedding.py`：定义 `EmbeddingProvider` 抽象基类（embed 方法）
- [x] 2.2 实现 `OpenAIEmbedding`：调用 OpenAI text-embedding-3-small API，支持批量（<=100 条）
- [x] 2.3 实现 `ZhipuEmbedding`：调用智谱 embedding-3 API
- [x] 2.4 实现 `LocalBGEEmbedding`：使用 sentence-transformers 加载 bge-small-zh-v1.5 本地模型
- [x] 2.5 实现 `get_embedding_provider()` 工厂函数：根据 EMBEDDING_PROVIDER 环境变量返回对应实例
- [x] 2.6 添加失败降级逻辑：超时 30s 返回 null + warning 日志
- [x] 2.7 更新 `agents/requirements.txt`：添加 pgvector 依赖；可选添加 sentence-transformers
- [x] 2.8 编写 `agents/tests/test_embedding.py` 单元测试

## 3. Embedding 服务——TypeScript 端

- [x] 3.1 创建 `src/lib/embedding.ts`：定义 EmbeddingProvider 接口 + getEmbeddingProvider 工厂
- [x] 3.2 实现 OpenAI embedding provider（使用 fetch 调用 API）
- [x] 3.3 实现失败降级：超时返回 null + console.warn
- [x] 3.4 导出 embedTexts 便捷函数供 route handler 使用

## 4. 记忆提取——LLM 结构化输出

- [x] 4.1 在 `src/app/api/chat/route.ts` 中创建 `extractMemoryWithLLM(content: string, userId: string)` 函数
- [x] 4.2 设计提取 prompt：输出 JSON 数组 `[{ category, subject, predicate, object, confidence }]`
- [x] 4.3 添加 JSON.parse try-catch 降级：解析失败不写入，记录 error 日志
- [x] 4.4 添加最小内容长度检查：回复 < 50 字符时跳过提取
- [x] 4.5 调用 embedTexts 为每条记忆生成 embedding 向量
- [x] 4.6 使用 Prisma raw SQL 写入 MemoryNode（含 embedding vector）
- [x] 4.7 根据 LLM 提取结果中的关系信息创建 MemoryEdge
- [x] 4.8 替换 `flush()` 中的 `extractAndSaveMemory`（旧正则方案）为新的 LLM 版本

## 5. 记忆检索——memory.recall Tool

- [x] 5.1 创建 `agents/base/tools/builtin/memory_tools.py`
- [x] 5.2 实现 `memory.recall` tool：接受 query + top_k 参数
- [x] 5.3 实现向量检索逻辑：query → embedding → pgvector 余弦相似度搜索
- [x] 5.4 实现混合排序：相似度分数 × 0.6 + accessCount 权重 × 0.2 + 时间衰减 × 0.2
- [x] 5.5 检索命中时递增 accessCount、更新 lastAccessAt
- [x] 5.6 实现降级：embedding 查询失败时退化为 subject/category 文本 LIKE 匹配
- [x] 5.7 在 PEC Agent 的 tool registry 中注册 `memory.recall`
- [x] 5.8 编写 `agents/tests/test_memory_tools.py` 单元测试

## 6. 记忆注入——PEC Agent 集成

- [x] 6.1 修改 `agents/supervisor_agent/pec_agent.py`：Plan 阶段开始前自动调用 memory.recall
- [x] 6.2 将检索结果通过 ContextBuilder.inject_memory() 注入为 env_context
- [x] 6.3 处理无相关记忆的情况：检索结果为空时不注入
- [x] 6.4 修改 `src/app/api/chat/route.ts`：移除旧的 `loadSessionMemory` 调用（记忆检索已迁至 Python 端）

## 7. ConversationSummary 集成

- [x] 7.1 修改 `src/lib/agents/summarizer.ts`：摘要生成后写入 ConversationSummary 表
- [x] 7.2 调用 embedTexts 生成摘要的 embedding 向量
- [x] 7.3 使用 Prisma raw SQL 写入 ConversationSummary（含 vector 字段）
- [x] 7.4 在 memory.recall 中增加 ConversationSummary 的向量检索（与 MemoryNode 结果合并）

## 8. RAG——文档解析与分块

- [x] 8.1 创建 `agents/base/rag/chunker.py`：实现递归分块器（段落 → 句子 → 字符）
- [x] 8.2 实现 chunk_size=512 tokens / overlap=64 tokens 的分块逻辑
- [x] 8.3 创建 `agents/base/rag/parser.py`：PDF 解析（pdfplumber）+ 网页解析（BeautifulSoup）+ 纯文本
- [x] 8.4 实现元数据保留：每个 chunk 记录 page、sourceUrl、docType
- [x] 8.5 编写 `agents/tests/test_chunker.py` 单元测试

## 9. RAG——文档摄入管线

- [x] 9.1 创建 `agents/base/rag/ingest.py`：文档摄入主逻辑（解析 → 分块 → embedding → 存储）
- [x] 9.2 实现 fileHash 去重：摄入前检查 Document.fileHash
- [x] 9.3 实现批量 embedding：单批 <= 100 条，失败的 chunk embedding 置 null
- [x] 9.4 实现 Document 状态流转：pending → processing → ready | error
- [x] 9.5 使用 Prisma raw SQL 批量写入 DocumentChunk（含 embedding vector）
- [x] 9.6 实现摄入超时控制：总耗时 > 120s 设为 error

## 10. RAG——Agent Tools

- [x] 10.1 创建 `agents/base/tools/builtin/rag_tools.py`
- [x] 10.2 实现 `rag.search` tool：query → embedding → pgvector 余弦检索 DocumentChunk
- [x] 10.3 支持 doc_type 过滤参数（仅检索指定类型文档）
- [x] 10.4 实现结果格式：`{ content, score, metadata: { page, sourceUrl, docTitle, docType } }`
- [x] 10.5 实现 `rag.ingest` tool：接受 URL/file_path，触发摄入管线
- [x] 10.6 在 PEC Agent 的 tool registry 中注册 `rag.search` 和 `rag.ingest`
- [x] 10.7 编写 `agents/tests/test_rag_tools.py` 单元测试

## 11. RAG——文档管理 API

- [x] 11.1 创建 `src/app/api/rag/ingest/route.ts`：POST 接收 multipart/form-data 或 JSON URL
- [x] 11.2 创建 `src/app/api/rag/documents/route.ts`：GET 列出文档（分页）
- [x] 11.3 创建 `src/app/api/rag/documents/[id]/route.ts`：DELETE 删除文档及 chunks
- [x] 11.4 创建 `src/app/api/rag/search/route.ts`：POST 直接向量检索（调试用）
- [x] 11.5 所有路由添加 getSession 鉴权检查

## 12. 迁移与清理

- [x] 12.1 创建迁移脚本 `scripts/migrate-session-memory.mjs`：SessionMemory → MemoryNode
- [x] 12.2 迁移后验证 MemoryNode 条数 >= SessionMemory 条数
- [ ] 12.3 为迁移后的 MemoryNode 批量生成 embedding 向量（待有数据后执行）
- [ ] 12.4 从 Prisma schema 中删除 SessionMemory 模型（待验证完成后执行）
- [x] 12.5 清理 route.ts 中旧的 extractAndSaveMemory / loadSessionMemory / STOCK_PATTERNS 代码

## 13. 集成验证（手动）

- [ ] 13.1 验证 embedding 服务：切换 EMBEDDING_PROVIDER 到不同 provider，确认向量生成正常
- [ ] 13.2 验证记忆提取：对话后检查 MemoryNode 表，确认 LLM 提取的实体/结论准确
- [ ] 13.3 验证记忆检索：新对话中提及历史分析的股票，确认 Plan 阶段自动注入了相关记忆
- [ ] 13.4 验证 RAG 摄入：上传一个研报 PDF，检查 Document + DocumentChunk 表数据正确
- [ ] 13.5 验证 RAG 检索：对话中让 Agent 检索研报内容，确认 rag.search 返回相关片段
- [ ] 13.6 验证降级：关闭 embedding API，确认记忆和 RAG 功能降级而非崩溃
