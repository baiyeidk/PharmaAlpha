## ADDED Requirements

### Requirement: Embedding Provider 抽象接口

系统 SHALL 提供 `EmbeddingProvider` 抽象基类（Python）和对应 TypeScript 接口，定义统一的文本向量化契约。接口 SHALL 包含 `embed(texts: list[str]) -> list[list[float]]` 方法，支持批量输入。

#### Scenario: Python 端调用 embedding
- **WHEN** 调用 `get_embedding_provider().embed(["恒瑞医药投资分析"])`
- **THEN** 返回长度为 1 的 float 数组列表，每个内部数组长度等于 `EMBEDDING_DIMENSIONS` 环境变量值

#### Scenario: TypeScript 端调用 embedding
- **WHEN** 调用 `getEmbeddingProvider().embed(["恒瑞医药投资分析"])`
- **THEN** 返回与 Python 端相同维度的向量数组

#### Scenario: 批量 embedding
- **WHEN** 传入 N 条文本（N <= 100）
- **THEN** 返回 N 个向量，顺序与输入一致

### Requirement: 多模型热插拔

系统 SHALL 支持通过 `EMBEDDING_PROVIDER` 环境变量切换 embedding 提供者，无需修改代码。MUST 支持以下三种 provider：
- `openai`: OpenAI text-embedding-3-small（默认）
- `zhipu`: 智谱 embedding-3
- `local`: 本地 BGE-small-zh-v1.5（sentence-transformers）

#### Scenario: 切换到 OpenAI provider
- **WHEN** 设置 `EMBEDDING_PROVIDER=openai` 和有效的 `EMBEDDING_API_KEY`
- **THEN** `get_embedding_provider()` 返回 `OpenAIEmbedding` 实例，调用 OpenAI embedding API

#### Scenario: 切换到本地 BGE provider
- **WHEN** 设置 `EMBEDDING_PROVIDER=local`
- **THEN** `get_embedding_provider()` 返回 `LocalBGEEmbedding` 实例，使用本地模型推理，不需要 API key

#### Scenario: provider 未配置时的默认行为
- **WHEN** `EMBEDDING_PROVIDER` 环境变量未设置
- **THEN** 默认使用 `openai` provider

### Requirement: 向量维度配置

向量维度 SHALL 通过 `EMBEDDING_DIMENSIONS` 环境变量统一配置。所有 provider MUST 输出该维度的向量。Prisma schema 中的 `vector(N)` 的 N MUST 与此值一致。

#### Scenario: 维度一致性保证
- **WHEN** 设置 `EMBEDDING_DIMENSIONS=1536`
- **THEN** 所有 provider 输出的向量长度均为 1536

#### Scenario: 维度未配置
- **WHEN** `EMBEDDING_DIMENSIONS` 未设置
- **THEN** 默认值为 1536

### Requirement: Embedding 失败降级

Embedding 调用失败（网络超时、API 配额耗尽等）MUST NOT 导致核心功能崩溃。系统 SHALL 返回 null 或空向量，并记录警告日志。

#### Scenario: API 超时降级
- **WHEN** embedding API 调用超过 30 秒未返回
- **THEN** 返回 null，记录 warning 级别日志，调用方正常执行后续逻辑（跳过向量写入/检索退化为结构化查询）
