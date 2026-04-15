## Why

当前 PharmaAlpha 的跨会话记忆依赖正则提取 + 扁平 KV 存储（`SessionMemory` 表），实体提取质量差、无语义检索、无记忆整合能力。同时项目缺少 RAG 服务，Agent 无法利用用户上传的研报/财报等文档进行增强回答。记忆系统和 RAG 共享 Embedding + 向量检索基础设施，应作为一个整体工程来设计。

## What Changes

- 新增 **pgvector 向量检索层**：在现有 PostgreSQL 上启用 pgvector 扩展，支持 embedding 存储和近邻搜索
- 新增 **Embedding 服务**：抽象 `EmbeddingProvider` 接口，Python/TypeScript 双端实现，支持 OpenAI / 智谱 / 本地 BGE 热插拔
- 重构 **记忆系统**：用 LLM 结构化提取替代正则，引入三级记忆模型（Episodic / Semantic / User Profile），支持向量语义检索 + 时间衰减 + 访问频率加权
- 新增 **RAG 文档管线**：PDF/网页/文本解析 → 递归分块 → embedding → pgvector 存储，支持文档生命周期管理
- 新增 **RAG Agent Tool**：`rag.search` 和 `rag.ingest` 注册到 PEC Agent，execute 阶段按需调用
- 新增 **文档管理 API**：Next.js API routes 用于文档上传、列表、删除、搜索
- **BREAKING** 废弃 `SessionMemory` 模型，迁移数据到新的 `MemoryNode` / `MemoryEdge` 图结构

## Capabilities

### New Capabilities
- `embedding-service`: 统一的 Embedding 提供者抽象层（Python + TypeScript），支持多模型热插拔
- `memory-graph`: 基于 pgvector 的图结构记忆系统，包含 LLM 提取、语义检索、记忆衰减与合并
- `rag-pipeline`: 文档摄入（解析/分块/embedding）+ 向量检索 + Agent tool 集成 + 管理 API

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **数据库**: 新增 pgvector 扩展；新增 5 个 Prisma 模型（MemoryNode, MemoryEdge, ConversationSummary, Document, DocumentChunk）；废弃 SessionMemory
- **Python 依赖**: 新增 `pgvector` 包；可选 `sentence-transformers`（本地 embedding）
- **环境变量**: 新增 `EMBEDDING_PROVIDER`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`
- **Agent 系统**: PEC Agent 新增 `rag.search`, `rag.ingest`, `memory.recall` 三个 tool；Plan 阶段自动注入记忆上下文
- **API 层**: `route.ts` 的 `extractAndSaveMemory` 替换为异步 LLM 提取；新增 `/api/rag/*` 路由组
- **前端**: 需要新增文档管理界面（上传/列表/删除）
