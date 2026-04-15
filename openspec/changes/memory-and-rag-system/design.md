## Context

PharmaAlpha 是一个医药投资助手平台，核心是 PEC Agent（Plan-Execute-Check）。当前存在两个关键缺陷：

1. **记忆系统**：跨会话记忆依赖正则提取 + `SessionMemory` 扁平 KV 表，提取质量差（"中药业股票代码"等脏数据），无语义检索，无记忆整合
2. **知识检索**：Agent 无法利用用户上传的研报、财报等文档增强回答

现有技术栈：
- PostgreSQL（Prisma ORM）、Next.js 16 App Router、Python Agent 子进程（stdin/stdout JSON Lines 协议）
- LLM：DeepSeek（OpenAI 兼容 API）
- 无 Redis、无向量数据库、无消息队列

## Goals / Non-Goals

**Goals:**
- 构建工程级记忆系统：LLM 结构化提取 → 图结构存储 → 向量语义检索
- 构建 RAG 管线：文档解析 → 分块 → embedding → 向量检索，作为 Agent tool 按需调用
- 共享 Embedding 基础设施：记忆和 RAG 复用同一 embedding 服务层
- 保持零新外部服务：基于现有 PostgreSQL + pgvector 扩展

**Non-Goals:**
- 不做实时 streaming RAG（每次检索是单次 tool 调用，非持续流式）
- 不做多用户记忆隔离的权限系统（当前单租户）
- 不做文档 OCR（仅处理可提取文本的 PDF）
- 不做独立的向量数据库服务（Qdrant/Milvus 等留作后续扩展）
- 不做前端文档管理 UI（本次仅做 API，前端后续迭代）

## Decisions

### D1: 向量存储选择 pgvector

**决策**: 在现有 PostgreSQL 上启用 pgvector 扩展。

**备选方案**:
| 方案 | 优点 | 缺点 |
|------|------|------|
| pgvector (选定) | 零新服务、事务一致性、Prisma raw SQL 即可 | 性能上限约 100 万向量 |
| Qdrant Docker | 专用向量引擎、HNSW 性能更强 | 新增服务、数据一致性需自行保证 |
| 纯 PG 全文检索 | 最简单 | 无语义匹配能力 |

**理由**: 当前数据规模（记忆 < 1 万条、文档 chunks < 10 万条）远低于 pgvector 性能瓶颈。零新服务降低运维复杂度。

### D2: Embedding 模型抽象

**决策**: 定义 `EmbeddingProvider` 抽象接口，Python 和 TypeScript 双端实现。默认使用 OpenAI `text-embedding-3-small`（1536 维）。

**备选方案**:
| 方案 | 维度 | 中文效果 | 成本 |
|------|------|----------|------|
| OpenAI text-embedding-3-small (默认) | 1536 | 良好 | $0.02/1M tokens |
| 智谱 embedding-3 | 2048 | 优秀（中文优化） | 按量计费 |
| 本地 BGE-small-zh | 512 | 良好 | 零成本、~500MB 模型 |

**理由**: OpenAI 最成熟稳定；抽象接口允许后续切换到智谱（中文更优）或本地 BGE（零成本开发）。向量维度通过 `EMBEDDING_DIMENSIONS` 环境变量配置。

### D3: 记忆提取策略——LLM 结构化输出

**决策**: 对话结束后，异步调用 DeepSeek 提取结构化记忆（JSON 格式），替代当前正则方案。

**提取 schema**:
```json
[{
  "category": "entity | conclusion | preference | event",
  "subject": "主体名称",
  "predicate": "关系/属性",
  "object": "值",
  "confidence": 0.0-1.0
}]
```

**理由**: 正则无法理解上下文（"分析一下恒瑞" → 正则提取不到任何实体）；LLM 能理解语义并输出结构化数据。额外成本约 0.5 次 LLM 调用/对话，可接受。

**异步执行**：在 SSE 流的 `flush()` 阶段触发，不阻塞用户响应。提取失败不影响核心流程。

### D4: 记忆存储——图结构（MemoryNode + MemoryEdge）

**决策**: 用 `MemoryNode`（三元组：subject-predicate-object）+ `MemoryEdge`（关系边）替代扁平 KV。

**理由**:
- 三元组天然支持知识图谱式查询："恒瑞医药的所有分析结论"
- Edge 连接相关记忆："恒瑞医药" → compared_with → "药明康德"
- embedding 字段支持语义检索
- `accessCount` + `lastAccessAt` 支持记忆衰减

### D5: RAG 触发方式——Agent Tool

**决策**: RAG 检索作为 PEC Agent 的 tool（`rag.search`），由 LLM 在 execute 阶段主动调用。

**备选方案**:
| 方案 | 优点 | 缺点 |
|------|------|------|
| Agent Tool (选定) | LLM 自主判断何时需要、查什么 | 依赖 LLM 决策质量 |
| 每轮自动检索 | 不遗漏 | 浪费 embedding 调用 |

**理由**: 投资分析中并非每轮对话都需要文档检索（如"你好"、"总结一下"）。由 LLM 按需调用更精准、更省成本。

### D6: 文档分块策略——递归分块

**决策**: 递归分块（段落 → 句子 → 字符），chunk_size=512 tokens，overlap=64 tokens。

**理由**: 512 tokens 是语义完整性和检索精度的平衡点。递归策略优先保持段落完整性。overlap 防止关键信息被切断。

### D7: Prisma 与 pgvector 的集成方式

**决策**: Prisma schema 中 embedding 字段用 `Unsupported("vector(N)")`，向量操作通过 `prisma.$queryRawUnsafe()` 执行原生 SQL。

**理由**: Prisma 目前不原生支持 pgvector 类型。`Unsupported` 类型让 Prisma 生成表结构，查询时用 raw SQL 做向量近邻搜索。这是社区推荐的标准做法。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| pgvector 扩展未安装 | 部署失败 | 启动时检查 `SELECT * FROM pg_extension WHERE extname='vector'`；README 提供安装指引 |
| LLM 提取返回非法 JSON | 记忆写入失败 | JSON.parse 外包 try-catch，失败时回退到不写入（不影响核心对话） |
| Embedding API 不可用 | 记忆/RAG 写入和检索均失败 | 写入失败跳过 embedding，检索退化为结构化查询 |
| 向量维度不一致 | 检索报错 | 统一通过 `EMBEDDING_DIMENSIONS` 控制，schema migration 时锁定维度 |
| `SessionMemory` 迁移数据丢失 | 旧记忆消失 | 迁移脚本在删除旧表前验证新表数据条数 |

## Migration Plan

1. **Phase 1**: 安装 pgvector 扩展 → Prisma schema 新增 5 个模型 → `prisma db push`
2. **Phase 2**: 实现 Embedding 服务（Python + TS）→ 单元测试
3. **Phase 3**: 实现记忆提取/检索 → 集成到 PEC Agent
4. **Phase 4**: 实现 RAG 管线 → 注册为 Agent tool
5. **Phase 5**: 迁移 SessionMemory 数据 → 删除旧模型 → 替换 route.ts 集成点
6. **Rollback**: 保留 `SessionMemory` 模型直到 Phase 5 验证完成；环境变量 `MEMORY_SYSTEM=legacy|v2` 控制切换
