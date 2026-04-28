---
title: PharmaAlpha 面试自查文档
aliases:
  - 字节面试自查
  - 面试 PharmaAlpha
  - PEC Agent 面试
tags:
  - 面试/字节
  - 项目/PharmaAlpha
  - 方向/后端Agent
  - 类型/复习
created: 2026-04-27
updated: 2026-04-27
status: 进行中
cssclasses:
  - interview-prep
---

# PharmaAlpha 面试自查文档（字节后端 Agent 方向）

> [!tip] 用法
> - 把这份文档当成"面试官追问清单"。**每个 Q 都要在镜子前讲一遍**，能讲清楚就标 ✅，讲不清就回到对应代码读一遍。
> - 项目代码 90% 是 AI 生成 ≠ 你不需要懂。**简历写了什么，面试官就按"主理人"标准追问什么。**
> - 折叠的 callout（带 `-`）默认收起，需要复习时点开展开。

> [!abstract]+ 目录导航
> - [[#0. 30 秒电梯讲清楚 PharmaAlpha（必背）]]
> - [[#1. 整体架构 - 必问]]
> - [[#2. 三层记忆架构 - 必问，这是简历亮点也是雷区]]
> - [[#3. 技术选型 + RAG 完整流水线（必问，技术深度集中考察点）|3. 技术选型 + RAG 完整流水线 ⭐]]
> - [[#4. ContextBuilder 上下文工程 - 必问]]
> - [[#5. 工具调用层 - 中等概率问]]
> - [[#6. Harness 工程范式实现专题（字节关心的前沿，必问）|6. Harness 工程范式专题 ⭐]]
> - [[#7. 容量评估 / 性能 / 量级（必备数字）]]
> - [[#8. 简历表达 / 雷区清单（面试前必看）|8. 简历雷区清单 🚨]]
> - [[#9. 面试前自检清单]]
> - [[#10. 字节后端 Agent 方向常见追问 - 提前准备]]
> - [[#11. 临时复习提纲（面试前 2 小时刷一遍）|11. 临时复习提纲（T-2h） ⏱]]

---

## 0. 30 秒电梯讲清楚 PharmaAlpha（必背）

> [!summary]+ 一句话定位
> PharmaAlpha 是一个面向医药投资分析的智能体平台，核心是把通用 LLM（DeepSeek）通过 **Plan-Execute-Check + Harness 工程范式** 包装成具备垂直领域自主分析能力的 Agent，配套**三层记忆架构**和**ContextBuilder 上下文工程**保证长程对话的稳定性。

> [!example]+ 技术亮点（按优先级背）
> 1. **单进程 PEC 循环**（Plan-Execute-Check）+ 综合阶段 Synthesize，最多 3 轮自迭代
> 2. **三层记忆**：短期（滚动窗口 + check 反馈）/ 长期（SPO 三元组 + 向量×频率×时间衰减）/ 知识（RAG: 递归分块 → 1024 维 embedding → pgvector）
> 3. **ContextBuilder 上下文工程**：5 类语义标签分层（system_prompt / env_context / chat_history / phase_inject / tool_result）+ 两级截断（工具结果硬截断 2000 char，超预算后按标签优先级移除）+ 装配顺序固定（phase_inject 放最后利用 recency bias）
> 4. **Harness 工程范式 6 维度**：输入约束 / 决策约束（json_object + 三层鲁棒解析）/ 执行约束（PEC 3 轮 + ToolLoop 10 次双层熔断）/ 输出约束（Check LLM as Judge + Gaps 反馈循环）/ 观测（jsonl 全链路日志）/ 降级（embedding 失败 ILIKE 兜底 + 多 provider 抽象）

> [!info] 业务背景
> 通用 LLM 直接做投资分析有三个痛点 ——
> - 数据陈旧（2023 截止）
> - 容易瞎编（没有结构化校验）
> - 无法多轮自迭代（一次性回答不够深入）
>
> PharmaAlpha 用 **PEC + 工具调用 + RAG** 解决这三个问题。

---

## 1. 整体架构 - 必问

### Q1.1 简单画一下你这个 Agent 的架构

**标准答法**（口述时按这个顺序讲）：

```
[用户请求]
    ↓
[ContextBuilder 装配上下文：system_prompt + memory + rag + canvas_history + chat]
    ↓
[Round Loop, 最多 3 轮]
    ├─ PLAN（call_llm_json，强制 JSON 输出，产出 steps）
    ├─ EXECUTE（run_tool_loop，流式 + Function Calling，最多 10 次工具循环）
    │     └─ Runtime Budget Guard（>80% 预算时截断历史 tool 消息）
    └─ CHECK（call_llm_json，返回 {passed, summary, gaps}）
        ├─ passed=true → break
        └─ passed=false → 把 gaps 注入下轮 short_term_memory
    ↓
[SYNTHESIZE: 用 canvas 子工具集生成最终回复 + 画布节点]
```

**对应代码**：`agents/supervisor_agent/pec_agent.py:390-553`

### Q1.2 为什么是 Plan-Execute-Check 而不是纯 ReAct？

**标准答法**：

| 维度 | ReAct | Plan-and-Solve | PEC（本项目） |
|------|-------|----------------|----------------|
| 决策粒度 | 每步决策 | 一次性完整 plan | 每轮 plan，多轮迭代 |
| Token 成本 | 高（多次完整 prompt） | 低 | 中（plan 阶段精简，execute 阶段流式） |
| 错误恢复 | 弱（出错就跑偏） | 弱（plan 错了纠不回） | 强（Check 阶段显式校验，gaps 反馈到下一轮 plan） |
| 适用场景 | 探索性任务 | 已知流程 | **垂直领域，需要校验完整性** |

**项目的关键决策**：垂直投资分析任务**有明确的完整性标准**（如"用户要财报，是否拿到了？"），所以 Check 阶段用 LLM as judge 校验 gaps，比 ReAct 的"边走边看"更可控。

### Q1.3 为什么 MAX_PEC_ROUNDS = 3？为什么 MAX_TOOL_LOOPS = 10？

**标准答法**：
- **3 轮**：经验值，超过 3 轮通常说明 Plan 本身有问题（数据源不存在、用户请求模糊），继续重试也是无效消耗。3 轮 × 平均 5 个工具调用 ≈ 15 次 LLM 调用，单次会话成本可控。
- **10 次工具循环**：单轮 Execute 的工具调用上限。普通投资分析任务平均需要 3-5 次（拉行情 + 拉财报 + 搜研报 + 写画布），10 是 2x 余量，防止 LLM 死循环调用同一工具。

**加分点**：能说出"我做过统计，实际 P95 是 X 次工具调用"——但目前你没埋这个点，所以不要瞎编，可以说"这是经验阈值，下一步要补埋点统计实际分布"。

### Q1.4 这套架构最大的弱点是什么？

> [!question]+ 字节面试官最爱问的反向问题
> 必须有诚实答案。**不能说"没弱点"**，否则会被 follow up 到崩。

**标准答法**（选 2-3 个讲）：

1. **延迟高**：3 轮 PEC + 多次工具调用，端到端 P95 可能到 30-60 秒，对用户体验不友好。**改进方向**：流式返回 plan / partial 结果，让用户看到进度而不是空转。
2. **LLM as Judge 的偏差**：Check 阶段用同一个模型判定 passed，存在 self-bias（自己写的自己说好）。**改进方向**：用更强模型当 judge，或加结构化校验（必填字段 schema）。
3. **没有 Plan 缓存**：相同问题每次都重新 Plan，浪费 token。**改进方向**：query 语义哈希 + Plan 模板复用。
4. **工具失败容忍策略简单**：当前只是"失败就跳过继续"，没有重试或 fallback 工具。**改进方向**：按错误类型分类（rate-limit / 数据不存在 / 网络），分别处理。

---

## 2. 三层记忆架构 - 必问，这是简历亮点也是雷区

> [!danger] 致命错误避雷
> 你之前面试时把 **SPO 三元组**答成了 "planner-execute-check"，**这是致命错误**。
> - SPO = **S**ubject-**P**redicate-**O**bject，是知识图谱的标准术语
> - 你代码里 `MemoryNode` 表就是这么建的（见 `prisma/schema.prisma:154-176`）
> - 别再混淆它和 PEC 工作流了！

### Q2.1 三层记忆分别是什么？为什么这样分？

**标准答法**（口述用这个结构）：

| 层 | 存储位置 | 数据形态 | 生命周期 | 检索方式 |
|---|---------|---------|---------|---------|
| **短期** | 进程内内存 | execute 结果 / check summary / gaps | 单次会话 | 拼接到 plan prompt |
| **长期** | PostgreSQL `MemoryNode` 表 | SPO 三元组 + 1024 维 embedding | 跨会话持久化（30 天半衰期） | 向量×频率×时间衰减混合检索 |
| **知识** | PostgreSQL `Document` + `DocumentChunk` 表 | 文档分块 + embedding | 永久（源数据沉淀） | pgvector 余弦相似度 top-k |

**为什么这样分**：
- 短期：让 Agent 知道"本轮我已经做了什么、还差什么"，避免重复执行 → 解决多轮一致性
- 长期：让 Agent 知道"这个用户之前关注过恒瑞医药"，避免每次重新介绍 → 解决跨会话个性化
- 知识：让 Agent 知道"用户之前导入过这份研报"，避免重复获取 → 解决数据复用 + 减少外部 API 调用

### Q2.2 短期记忆具体怎么实现？

**对应代码**：`pec_agent.py:323-343` `_build_short_term_memory`

**标准答法**：
- **不是**简单的 token 阈值压缩，而是**结构化提取关键信息**
- 短期记忆由三部分构成：
  1. `execute_results[-2:]`：最近 2 轮的执行结果（每轮压缩到 1000 char）
  2. `check_summaries[-3:]`：最近 3 轮的审查结论
  3. `check_feedback`（gaps）：当前待补缺口
- 这些会被拼成 markdown 格式注入到下一轮 Plan 的 system message 里

**为什么这么设计**：
- 不是无脑塞历史，而是按"已做 / 已校验 / 待补"三个维度结构化，让 Plan 知道增量做什么
- 用 `_compact_text` 做 1200 字符硬截断防止单条爆炸

**追问准备**：如果问"为什么不用 LLM 压缩历史" → "压缩本身要消耗一次 LLM 调用，且压缩可能丢失关键数字。当前结构化拼接 + 硬截断在我们的场景下足够，且零额外延迟。"

### Q2.3 SPO 三元组（必问，必背）

**对应代码**：`prisma/schema.prisma:154-176` `MemoryNode` 表

**SPO 字段定义**：
- **Subject**（主体）：实体名，如"恒瑞医药"
- **Predicate**（谓词/关系）：属性名，如"2024_研发投入"
- **Object**（宾语/值）：实际内容，如"82 亿元"
- **category**：entity / conclusion / preference / event 四类
- **confidence**：抽取置信度（0-1）

**示例**：用户说"恒瑞医药 2024 年研发投入是 82 亿"

```json
{
  "category": "entity",
  "subject": "恒瑞医药",
  "predicate": "2024_研发投入",
  "object": "82 亿元",
  "confidence": 0.95
}
```

**追问准备**：
- "怎么从对话里抽出 SPO？" → "目前是规则 + LLM 抽取的混合方式：identifies entities → 调用 LLM 给定 schema 让它输出 JSON → 校验后落库。**坦白说当前抽取覆盖率不高，未来要加专门的 entity-linking 模型**"
- "Predicate 的命名规范？" → "时间_属性 形式，避免同义谓词（'营收 / 主营收入'）造成检索分裂"
- "为什么不用三元组图存（如 Neo4j）？" → "当前查询模式是按 subject 检索 + 向量相似度，不需要图遍历。MemoryEdge 表预留了边关系，未来如果做'实体关联推理'再启用"

### Q2.4 混合检索公式（**必背，公式要默写**）

**对应代码**：`agents/base/tools/builtin/memory_tools.py:35-92`

**最终公式**：
```
final_score = similarity * 0.6 + freq_score * 0.2 + decay * 0.2
```

**三个维度展开**：

1. **Similarity（向量相似度）**
   ```
   similarity = 1 - (embedding <=> query_vec)   -- pgvector 余弦距离转相似度
   ```
   权重 0.6 → 相关性是主导

2. **Frequency Score**
   ```
   freq_score = min(access_count / 20.0, 1.0)
   ```
   - 线性归一化到 [0, 1]，20 次访问后封顶（防止热门记忆永久霸占）
   - 权重 0.2 → 高频访问的记忆有"重要性加成"

3. **Decay Score（指数时间衰减）**
   ```
   decay = exp(-0.693 * age_days / 30)
   ```
   - 半衰期 30 天（30 天后分数减半，60 天减到 0.25）
   - 0.693 ≈ ln(2)，是半衰期的标准实现
   - 权重 0.2 → 越新的记忆分数越高

**追问准备**：

| 追问 | 你怎么答 |
|------|---------|
| 为什么是加权求和不是乘法？ | 加法更稳健 —— 任一维度为 0 不会让总分归零。乘法适合"必须全部满足"的场景，比如检索质量是 0.0 那应该直接淘汰；但我们的场景里"用户高频访问"的旧记忆也有价值。 |
| 0.6/0.2/0.2 怎么定的？ | 经验值，参考了 HelloAgent / MemoryBank 等开源记忆系统的方案。**当前没做 A/B 调优，未来会按 recall@5 指标做权重 tuning** |
| 为什么半衰期是 30 天？ | 投资场景里"季度财报"是典型周期，30 天约等于半个季度，让上一季度的数据保留约 0.7 的影响力。 |
| 时间衰减为什么用指数不用线性？ | 1) 数学性质好（永远 > 0，不会出现负分）；2) 接近艾宾浩斯遗忘曲线；3) 计算便宜（一次 exp） |

> [!warning] 禁词
> 绝对不要说"**抄的**"！
> 标准说法："参考了 X 项目（HelloAgent / MemoryBank）的实现方案，**结合业务做了 weight 调整**。"

### Q2.5 为什么用 PostgreSQL + pgvector，不用 Milvus / Pinecone / Redis？

**一句话答**：业务侧需要"按 user_id 过滤 + embedding 检索 + frequency 排序"的混合查询，**pgvector 让我一条 SQL 搞定，且与 SPO 字段强一致**，不需要双写两个系统。

> [!info] 完整对比表 + 详细论点见
> → [[#Q3.2 为什么向量库选 pgvector，不选 Milvus / Pinecone / Qdrant / Redis Vector？]]

### Q2.6 ConversationSummary 是干嘛的？

**对应代码**：`prisma/schema.prisma:193-204`，`memory_tools.py:113-140`

**标准答法**：
- 长对话（>30 轮）时，用 LLM 把整段对话压缩成 summary + topics 列表，落到 ConversationSummary 表
- 检索时除了返回 SPO 节点，还会返回相似度 > 0.5 的 summary，作为补充上下文
- 这是 **MemoryBank-style** 的方案，解决"短期记忆滚动窗口丢失早期对话"的问题

---

## 3. 技术选型 + RAG 完整流水线（必问，技术深度集中考察点）

> [!important] 这一章是面试杀手锏
> 字节面试官最爱问"为什么选 X，不选 Y"。这一章把 PharmaAlpha 的核心选型和 RAG 链路一次讲透，**每个 Q 都要能口述 1 分钟以上**。

### Q3.1 为什么主存储选 PostgreSQL，不选 MySQL / MongoDB？

**对应代码**：`prisma/schema.prisma:6-8`（`provider = "postgresql"`）

**标准答法**（按维度对比，不要单一维度）：

| 维度 | PostgreSQL（选） | MySQL | MongoDB |
|------|-----------------|-------|---------|
| **向量支持** | **pgvector 扩展原生支持** | 8.0 才有 vector 类型，生态弱 | 有 Atlas Vector，但商业版 |
| **JSON 字段** | `JSONB` 支持索引和操作符（`@>` `?`） | `JSON` 类型查询性能差 | 原生 JSON，但失去关系约束 |
| **复杂查询** | 强（CTE / 窗口函数 / 子查询） | 弱（CTE 在 8.0 才支持） | 聚合管道学习曲线高 |
| **数据一致性** | 强 ACID + 外键 | 强 ACID | 弱（默认无事务） |
| **混合查询** | `embedding 检索 + userId 过滤 + frequency 排序` 一条 SQL 搞定 | 同左但无 vector | 双写两个系统才能实现 |
| **生态** | Prisma / pgvector / TimescaleDB 等扩展丰富 | 通用但偏 OLTP | 文档型场景才优 |

**项目里的关键论点**：
- `MemoryNode` 表混合了**关系数据**（userId、accessCount）+ **向量**（embedding）+ **半结构化**（metadata JSON）三种形态，**Postgres 一张表搞定**
- 检索 SQL 长这样（`memory_tools.py:58-69`）：
  ```sql
  SELECT id, subject, predicate, object, "accessCount", "lastAccessAt",
         1 - (embedding <=> %s::vector) AS similarity
  FROM "MemoryNode"
  WHERE "userId" = %s AND embedding IS NOT NULL
  ORDER BY embedding <=> %s::vector
  LIMIT %s
  ```
  **同一条 SQL 完成"按用户过滤 + 向量检索"**，MongoDB 需要两次查询双写一致性，MySQL 没原生向量支持。

> [!question]- 追问准备
> - **为什么不用 ClickHouse 这种 OLAP？** → 我们是**事务型读写**（用户对话 + memory 更新），不是分析型 batch 查询，OLAP 不合适
> - **数据量上来怎么办？** → Postgres 可以单表上亿 + 分区表 + 读写分离；超过 10 亿才考虑 ShardingSphere 或迁向量到 Milvus

### Q3.2 为什么向量库选 pgvector，不选 Milvus / Pinecone / Qdrant / Redis Vector？

**对应代码**：schema 里 `embedding Unsupported("vector(1024)")` 三个表（`MemoryNode` / `ConversationSummary` / `DocumentChunk`）

**标准答法**：

| 选项 | 优势 | 劣势 | 选 vs 不选 |
|------|------|------|----------|
| **pgvector**（选） | 1. **跟主库同库强一致**：embedding 和 SPO 字段同事务 2. SQL JOIN（如按 userId 过滤）简单 3. 部署简单（一个 Postgres） 4. 维护成本低 | 大规模（>1000w 向量）性能弱于专用 | **本项目记忆+RAG 量级在 10w 级**，pgvector 完全够 |
| Milvus | 大规模高性能，HNSW/IVF/DiskANN 索引齐全 | 多组件（etcd/MinIO/Pulsar）运维重，需单独存元数据，**双写一致性难** | 杀鸡用牛刀，且当前没有 1000w+ 向量需求 |
| Pinecone | 全托管 SaaS，省运维 | **数据出境合规问题**（医药金融场景敏感），按量计费成本不可控 | 国内业务直接淘汰 |
| Qdrant | 开源 + 性能好 + 元数据 filter 强 | 仍需双写，社区不如 Milvus | 备选，但当前规模不需要 |
| Redis Vector | 极快（内存） | 内存成本高，持久化弱 | 不适合长期记忆持久化 |

> [!quote]+ 杀手锏话术（背下来一字不差）
> "我们业务侧需要的是 **'按 user_id 过滤 + embedding 检索 + frequency/decay 排序' 的混合查询**。
>
> pgvector 让我**一条 SQL 搞定**，且和 SPO 字段强一致。
>
> 如果用 Milvus，元数据需要单独存 PG 或自己内嵌，**双写不一致**会导致检索结果污染。
>
> 当前数据量级（万级 MemoryNode + 几千 DocumentChunk）pgvector 性能完全够，等到 1000w+ 再考虑迁移。"

> [!question]- 追问准备
> - **pgvector 用什么距离度量？** → 余弦距离（`<=>` 操作符），与归一化 embedding 配合，`similarity = 1 - distance`
> - **有没有建向量索引？** → ⚠️ **诚实答**："当前 schema 没显式建 IVFFlat 或 HNSW 索引，是默认全表扫描。**这是性能弱点**，10w 数据量内可接受，上量时要加 `CREATE INDEX ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops)`"
> - **1024 维怎么定的？** → 与默认 embedding 模型（如 BGE-large、text-embedding-3-small with dimensions=1024）匹配；选 1024 是召回精度和存储成本的平衡（1024 float32 = 4KB / 行）

### Q3.3 RAG 完整流水线（**必背，能整体讲清楚直接加分**）

```
[输入：file_path / url / text]
        ↓
   ┌─────────────────────────────────────┐
   │ 1. Parse 解析层                     │
   │    - PDF: pdfplumber 按页抽取       │
   │    - Web: requests + BS4 清洗 DOM   │
   │    - Text: 直接包装                 │
   │    输出：ParsedDocument(title, content, pages, file_hash)
   └─────────────────────────────────────┘
        ↓
   ┌─────────────────────────────────────┐
   │ 2. Hash 去重                        │
   │    SHA256(file_bytes) 或 SHA256(text)
   │    查 Document 表，已存在直接返回   │
   └─────────────────────────────────────┘
        ↓
   ┌─────────────────────────────────────┐
   │ 3. 创建 Document 记录               │
   │    status = 'processing'            │
   └─────────────────────────────────────┘
        ↓
   ┌─────────────────────────────────────┐
   │ 4. Chunk 分块（递归式）             │
   │    - 段落 → 句子 → 字符             │
   │    - 512 tokens, 64 tokens overlap  │
   │    - 保留 page metadata             │
   └─────────────────────────────────────┘
        ↓
   ┌─────────────────────────────────────┐
   │ 5. Embed 嵌入                       │
   │    - 批量（BATCH_LIMIT = 10）       │
   │    - 1024 维                        │
   │    - 失败容忍：单条失败不影响其他   │
   └─────────────────────────────────────┘
        ↓
   ┌─────────────────────────────────────┐
   │ 6. Store 落库                       │
   │    DocumentChunk 表：               │
   │    (content, metadata, embedding)   │
   │    embedding 失败时该 chunk vec=NULL│
   └─────────────────────────────────────┘
        ↓
   ┌─────────────────────────────────────┐
   │ 7. 状态终态                         │
   │    status = 'ready' / 'error'       │
   │    chunkCount = N                   │
   └─────────────────────────────────────┘

           --------------- 检索分隔线 ---------------

[查询：rag_search(query, top_k)]
        ↓
   ┌─────────────────────────────────────┐
   │ A. 查询 embedding                   │
   └─────────────────────────────────────┘
        ↓
   ┌─────────────────────────────────────┐
   │ B. SQL 联合查询                     │
   │    JOIN Document ON status='ready'  │
   │    WHERE embedding IS NOT NULL      │
   │    ORDER BY embedding <=> query     │
   │    LIMIT top_k                      │
   └─────────────────────────────────────┘
        ↓
   ┌─────────────────────────────────────┐
   │ C. 格式化引用                       │
   │    [相似度: 0.85] (来源: 恒瑞2024年报, 第3页)
   │    {内容片段}                       │
   └─────────────────────────────────────┘
```

**对应代码**：
- 解析：`agents/base/rag/parser.py`
- 摄入：`agents/base/rag/ingest.py`
- 分块：`agents/base/rag/chunker.py`
- 检索：`agents/base/tools/builtin/rag_tools.py`
- 工具：`rag_search` / `rag_ingest`（暴露给 Agent）

**几个关键工程细节**（**讲这些显得有深度**）：

1. **Hash 去重**（`parser.py:_compute_file_hash` + `ingest.py:58-69`）：用 SHA256 算 file_hash，**避免重复入库浪费 embedding 配额**（embedding 调用是项目最大成本之一）
2. **状态机**：Document.status 有 `pending → processing → ready / error` 四态，前端可以查询进度
3. **page-level metadata**：PDF 每个 chunk 知道自己来自第几页，**检索时可以输出"恒瑞 2024 年报 第 3 页"** 给用户做引用，提升可信度
4. **Web 清洗**：`parser.py:77` 把 `script/style/nav/header/footer/aside/iframe` 全 decompose 掉，避免 SEO 元素污染检索
5. **降级**：embedding 单条失败 chunk 也会落库（vec=NULL），只是检索时被 `WHERE embedding IS NOT NULL` 过滤掉，**不会让整个 ingest 失败**
6. **超时保护**：`INGEST_TIMEOUT = 120`s，超时标记 status=error，避免长尾文档卡死流水线

### Q3.4 分块策略详解

**对应代码**：`agents/base/rag/chunker.py`

**核心算法**：递归式分块（recursive chunking），优先级 **段落 → 句子 → 字符**。

**参数**：
- `DEFAULT_CHUNK_SIZE = 512` tokens
- `DEFAULT_OVERLAP = 64` tokens（约 12.5%）

**算法步骤**：
1. 先按段落分隔符（`\n\n`, `\n`）切
2. 段落超过 512 tokens 的，再按句号分隔符（`。!?；`）切
3. 句子还超的，按字符硬切（chars_per_chunk = chunk_size × 3，因为中文 1 字符 ≈ 1/3 token 估算）
4. 每个 chunk 之间保留 64 tokens overlap，**用尾部字符切片实现**（`text[-overlap*4:]` 然后截断到合适 token 数）

**为什么这么设计**：
- 段落优先 → 保留语义边界（避免把"恒瑞 2024 年报 营收 280 亿"这种语义单元切碎）
- 字符兜底 → 防止超长行（如表格、URL）让算法卡住
- 64 tokens overlap → 跨 chunk 边界的实体（如"恒瑞|医药 2024 财报"）能在两个 chunk 都被检索到，提升召回率

> [!question]- 追问准备
> - **为什么 512 不是 1024？** → 投资类文档信息密度高，512 tokens 一个 chunk 在**召回精度**和**上下文长度**间的平衡点；过大会导致 top-k 后总长度超标。
> - **中文 token 估算准吗？** → 用的是简单估算（中文 1 字符 ≈ 0.75 token），不准。生产环境应该用 `tiktoken` 或 BPE 分词器精确计数。
> - **为什么不按句子语义聚类（semantic chunking）？** → 1) 需要额外 embedding 调用，成本高；2) 聚类阈值难调；3) 当前递归式在投资文档场景效果够用，未来可以引入 SmoothQuant / SentenceTransformer 做语义边界检测。

### Q3.5 Embedding 模型选型

**对应代码**：`agents/base/embedding.py`

**标准答法**：
- 抽象了 `EmbeddingProvider` 基类，支持 4 种 provider：
  - **OpenAI**（`text-embedding-3-small`，海外）
  - **DashScope**（阿里 Qwen `text-embedding-v4`，国内）
  - **Zhipu**（智谱 `embedding-3`，国内）
  - **本地 BGE**（`BAAI/bge-small-zh-v1.5`，离线）
- 通过 `EMBEDDING_PROVIDER` 环境变量切换
- 统一维度 1024（默认值），与 `MemoryNode.embedding vector(1024)` 字段对齐
- 单例缓存（`_provider_cache`）避免重复加载本地模型
- 批量调用（`BATCH_LIMIT = 10`）减少网络往返

**为什么要做这层抽象**（**面试加分点**）：
1. **合规需要**：医药金融数据出境敏感，国内场景必须用 DashScope / Zhipu
2. **离线场景**：客户内网部署时用本地 BGE，不依赖外部 API
3. **成本控制**：高 QPS 场景 OpenAI 贵，本地 BGE 自托管便宜
4. **开闭原则**：换模型不动业务代码，加新 provider 只需实现 `EmbeddingProvider` 接口

> [!question]- 追问准备
> - **为什么选 1024 维？** → 1) 大多数主流 embedding 模型默认维度（OpenAI text-embedding-3-small 默认 1536 但支持 dimensions 参数降到 1024）；2) 1024 float32 = 4KB / 向量，10w 向量约 400MB 内存，**性价比平衡点**；3) 高维度（如 3072）边际收益小，存储成本翻倍
> - **维度变了怎么办（如换成 1536）？** → 当前 schema 是 `vector(1024)` 硬编码的，**当前是设计弱点**，换 embedding 模型需要全量迁移历史向量。**改进方向**：1) 按 provider 分表 / 加 dim 字段；2) 双写期 + 灰度切换；3) 离线 reindex 历史数据
> - **中文 embedding 哪个最好？** → 实测下来 BGE 系列召回最稳，DashScope v4 推理最快。如果业务允许网络调用优先 DashScope，离线场景 BGE-large

### Q3.6 RAG 当前的弱点 + 改进方向（反思加分）

| 弱点 | 改进方向 |
|------|---------|
| 没有向量索引（IVFFlat/HNSW），10w+ 数据后查询变慢 | 加 `CREATE INDEX ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops)` |
| 单纯向量检索，对长尾 query 召回差 | 加 BM25 + 向量混合检索（RRF 融合） |
| 没有 reranker，top-k 顺序不一定最优 | 加 cross-encoder（如 bge-reranker-large）做精排 |
| 中文 token 估算不准 | 用 tiktoken 精确计数 |
| Embedding 维度硬编码 vector(1024) | 按 provider 分表 + dim 字段 |
| 没有"文档新鲜度"加权 | metadata 加 publish_date，检索时融入时间衰减 |
| 切片忽略表格 / 公式结构 | 接入 unstructured / Nougat 做表格保留分块 |

---

## 4. ContextBuilder 上下文工程 - 必问

### Q4.1 ContextBuilder 标签分层 - 深度拆解（这是这章的核心）

**对应代码**：`agents/base/context_builder.py`

> [!quote]+ 一句话定义
> 标签分层 = 给 LLM 上下文里的每条消息打一个 `_tag`，让 **"装配顺序"** 和 **"截断优先级"** 都由代码确定，而不是由调用顺序决定。

#### 4.1.1 设计动机（为什么不直接 append？）

朴素做法（顺序 append 一个 list）有三个问题：
1. **截断时不知道丢谁**：context 超了要丢消息，没有"语义类型"信息只能瞎丢
2. **顺序耦合**：调用方必须按"正确顺序"调用，否则上下文乱掉
3. **难以增量修改**：想替换 memory 注入，无法精准定位

标签分层把"消息的语义角色"和"消息内容"解耦，**装配规则由 build() 内固定逻辑控制**，调用方按任意顺序调 API 都能得到一致结果。

> [!info] 关键细节
> `_tag` 字段在 `build()` 末尾会被 `pop` 掉，**对 OpenAI API 完全透明**，不会污染请求。

#### 4.1.2 五种标签详解

| 标签 | 内部字段 | 添加 API | 语义 | 典型内容 |
|------|---------|---------|------|---------|
| `system_prompt` | `_system` | `set_system()` | 系统人设 / 角色定义 | "你是 PharmaAlpha 的任务规划器..." |
| `env_context` | `_memory` | `inject_memory()` `inject_rag_context()` | 长期记忆 / RAG 预注入 | "## 用户历史记忆 ..." / "## 知识库中已有的相关数据..." |
| `env_context` | `_environment` | `inject_environment()` | 运行时环境 | 当前时间 / 画布已有节点 |
| `chat_history` | `_messages` | `add_messages()` | 对话历史 | user / assistant 消息 |
| `phase_inject` | `_phase_context` | `inject_phase_context()` | 阶段相关注入 | "请按以下计划执行：..." |

**几个微妙的设计**：

- `inject_memory` 是 `clear() + append`（**替换语义**），`inject_rag_context` 是直接 `append`（**累积语义**）—— 因为 memory recall 一次会话只调一次，RAG 可以多次预搜
- `_memory` 和 `_environment` **共享** `env_context` 标签，但功能区分（记忆 vs 运行时事实）
- `phase_inject` 的 `role` 是 **`user`** 不是 `system` —— 让 LLM 把"阶段指令"理解为"用户的最新请求"，触发 recency bias

#### 4.1.3 装配顺序（**这是分层的物理体现**）

不管调用方按什么顺序调 API，`build()` 都按**固定顺序**输出：

```
[0]   system_prompt          ← 角色定义
[1]   env_context (memory)   ← 长期记忆
[2]   env_context (rag)      ← 知识库预注入
[3]   env_context (env)      ← 当前时间 + 画布
...
[N]   chat_history (user)    ← 对话流
[N+1] chat_history (assistant)
...
[M]   phase_inject (user)    ← 当前阶段指令（最后！）
```

**关键设计逻辑**：
- **`phase_inject` 放最后**：利用 LLM 的 **recency bias**，越靠后的内容影响越大，让"当前阶段任务"压过历史噪音
- **`env_context` 在 `chat_history` 之前**：先了解世界状态、再读对话，避免 LLM 基于错误前提推理

#### 4.1.4 截断时的优先级（**标签真正发挥作用的地方**）

**优先级三级**（从高到低）：

```
┌─────────────────────────────────────────────┐
│ 🔴 永不删除（protected_tags）               │
│   - system_prompt                           │
│   - env_context (memory/rag/time/canvas)    │
│   - phase_inject                            │
│   - 最后 N 条 user 消息（默认 N=2）         │
├─────────────────────────────────────────────┤
│ 🟡 优先截断                                 │
│   - tool_result（先做 2000 char 硬截断）    │
├─────────────────────────────────────────────┤
│ 🟢 可丢弃                                   │
│   - 早期的 chat_history (user)              │
│   - 所有 chat_history (assistant)           │
└─────────────────────────────────────────────┘
```

**为什么这样分级**：

| 标签 | 为什么不能删 / 可以删 |
|------|-------------------|
| `system_prompt` | 删了 LLM 不知道自己是谁，**直接崩** |
| `env_context` | 删了 LLM 不知道现在做什么阶段、用户是谁，**会幻觉** |
| `phase_inject` | 删了等于本轮没指令，**LLM 不知道要干什么** |
| 最后 2 条 user | 当前用户问题，删了等于没问题 |
| 早期 user | 历史问题已被 memory / summary 沉淀，**可丢** |
| assistant | 历史回复，价值密度低，**最先丢** |
| tool_result | 大头噪音，**先硬截断、再丢** |

**两级截断物理顺序**：
1. **第一级（无脑硬截断）**：所有 `tool_result` 超过 2000 chars 直接砍尾，**无条件执行**
2. **第二级（按预算驱逐）**：硬截断后还超 40k tokens，按上面优先级表**整条消息删除**（不是截断内容，是 `pop` 掉，LLM 看不到痕迹）

#### 4.1.5 完整示例 · 一次 Plan 阶段的真实装配

调用代码：
```python
plan_ctx = ContextBuilder()
plan_ctx.set_system(build_plan_prompt())                      # → system_prompt
plan_ctx.add_messages(chat_messages)                          # → chat_history
plan_ctx.inject_memory("- [entity] 恒瑞医药 (2023_研发投入): 65 亿元")  # → env_context
plan_ctx.inject_rag_context("- 恒瑞医药 2023 年报全文 (来源: 上交所)")  # → env_context
messages = plan_ctx.build()
```

`build()` 输出（带标签，最后会 pop 掉 `_tag`）：
```python
[
  {"role": "system",    "content": "你是 PharmaAlpha...",         "_tag": "system_prompt"},
  {"role": "system",    "content": "## 用户历史记忆\n- ...",      "_tag": "env_context"},
  {"role": "system",    "content": "## 知识库中已有的...",        "_tag": "env_context"},
  {"role": "user",      "content": "你能分析下医药股吗？",        "_tag": "chat_history"},
  {"role": "assistant", "content": "可以，请告诉我具体公司...",   "_tag": "chat_history"},
  {"role": "user",      "content": "恒瑞医药 2024 财报怎么样？",  "_tag": "chat_history"},
]
```

如果总 token 超 40k，按以下顺序丢：
1. 老的 assistant 消息（"可以，请告诉我..."）
2. 早期非最后两条的 user 消息
3. **system_prompt / env_context / 最后一条 user 永远保留**

#### 4.1.6 局限性 + 改进方向（**反思加分点**）

| 局限 | 改进方向 |
|------|---------|
| 标签粒度粗（env_context 一锅烩） | 拆成 `env_memory` / `env_rag` / `env_runtime` 三级 |
| 优先级硬编码（protected_tags 是常量） | 每个标签带 `priority: int` 字段，截断按 priority 排序 |
| 没有"重要性评分"（chat_history 一视同仁） | 消息级 importance score（embedding 与当前 query 的相似度） |
| `MIN_KEEP_USER_MESSAGES = 2` 是经验值 | 按 query 类型 / 对话长度动态调整 |

#### 4.1.7 60 秒面试口述版本

> [!quote]+ 60 秒口述模板（背下来）
> "ContextBuilder 标签分层是给每条消息打一个语义标签，目前有 5 类：**system_prompt**（角色）、**env_context**（环境/记忆/RAG）、**chat_history**（对话）、**phase_inject**（阶段指令）、**tool_result**（工具输出）。
>
> **它解决两个问题**：
> 1. **装配顺序**：不管调用方按什么顺序调 API，`build()` 都按 `system → env → history → phase` 的固定顺序输出，phase_inject 在最后利用 recency bias 强化当前指令。
> 2. **截断优先级**：当 context 超 40k 时，protected 标签（system_prompt / env_context / phase_inject 和最后 2 条 user）永远保留，按 assistant → 早期 user → tool 的顺序丢，且 tool_result 还有一级 2000 char 硬截断。
>
> **这套设计解耦了'调用顺序'和'装配顺序'**，调用方写代码更自由，截断也更合理。当前局限是标签粒度太粗，未来要拆得更细。"

### Q4.2 为什么要预注入 memory / RAG，而不是让 Agent 自己调工具？

**标准答法**（这题答好直接加分）：

| 维度 | 让 LLM 自调工具 | 预注入 |
|------|---------------|---------|
| 延迟 | 多一次 LLM 调用 + 一次工具调用 | 0 额外 LLM 调用 |
| Token | 工具结果再注入，链路两次 | 直接注入，一次 |
| 命中率 | LLM 可能"觉得不需要"而漏调 | 100% 注入 |
| 风险 | 注入了无关信息浪费 token | 同左 |

**项目里的处理**：`pec_agent.py:428-429`，每次 PEC 循环开始前先 `_recall_memory` + `_pre_search_rag` 两次预拉，结果通过 `inject_memory` / `inject_rag_context` 打到 Plan 的上下文里。

> [!question]- 追问准备
> - **怎么避免预注入污染？** → query 用 `_build_recall_query` 提取最近 3 条用户消息拼接，过滤纯数字/超短消息（避免"1"这种 menu 选项触发误检索）
> - **如果 memory 里有冲突信息怎么办？** → 短期记忆优先级高于长期（`_build_short_term_memory` 在 plan_memory_context 里 append 在长期之后，LLM 倾向于看后面的内容），运行时通过 prompt 引导更新长期。

### Q4.3 Runtime Budget Guard 是什么？

**对应代码**：`pec_agent.py:258-287`

**标准答法**：
- Tool Loop 跑到中段时，检查 `llm_messages` 总 token 是否超过预算的 80%（`RUNTIME_BUDGET_RATIO = 0.8`）
- 如果超了，**保留最后一次 tool 结果完整**，把更早的 tool 消息做"头尾保留"截断（前 500 字 + `[...已截断]` + 后 500 字）
- 这样保证 LLM 还能看到关键的最新工具输出，不会因为历史 tool 噪音爆 context window

**为什么不直接丢弃旧消息**：
- Function Calling 协议要求 `tool_call_id` 配对，丢弃 tool 消息会破坏调用链
- 头尾保留可以保留消息存在性 + 关键内容（开头一般是"成功获取 XX 数据"，末尾一般是结构化 JSON 末段）

---

## 5. 工具调用层 - 中等概率问

### Q5.1 工具注册机制？

**对应代码**：`agents/base/tools/registry.py` + `schema.py` + `builtin/`

**标准答法**：
- `@tool(description=...)` 装饰器：从函数签名 + 类型注解自动生成 JSON Schema（OpenAI Function Calling 格式）
- `ToolRegistry` 维护 `name → callable` 映射，提供 `get_schemas()` 给 LLM、`execute(name, args)` 给执行器
- **两套 registry**：`_exec_registry`（13 个工具，给 Execute 阶段）vs `_synth_registry`（仅 2 个 canvas 工具，给 Synthesize 阶段）—— 防止 Synthesize 阶段误触发数据获取

### Q5.2 工具失败怎么处理？

**对应代码**：`pec_agent.py:241-248`，`ERROR_BRACKET_RE`

**标准答法**：
- 工具结果文本以 `[Error]` 或 `[错误]` 开头视为失败（`_is_tool_result_success`）
- 失败时不抛异常，而是把错误 message 当成 tool 结果继续返回给 LLM
- LLM 看到 `[TOOL:ERROR] xxx` 后**自行决定**：跳过 / 换工具 / 改参数重试
- Plan 提示词明确："工具失败时跳过继续"

**这个设计的争议**：
- 优点：简单、容错性强
- 缺点：**没有结构化错误分类**（rate-limit vs 网络 vs 数据不存在），LLM 处理质量取决于错误信息表达。**这是改进点**，可以引入错误码 + 重试策略。

---

## 6. Harness 工程范式实现专题（字节关心的前沿，必问）

> [!important] Harness 范式定义
> **Harness Engineering 不是某一段代码，而是一种工程范式** —— 把 LLM 当成不可靠组件，外部用确定性代码包住它，做"输入约束 / 决策约束 / 执行约束 / 输出约束 / 观测 / 降级"。

### Q6.1 用一句话讲清 Harness Engineering 是什么

> [!quote]+ 一句话定义（背下来）
> "Harness 是把 LLM 这个非确定性组件包在确定性代码里的工程范式。它不是单点技术，而是 6 个维度的总和：
> - **输入约束**（context 怎么装配）
> - **决策约束**（输出怎么解析）
> - **执行约束**（循环怎么熔断）
> - **输出约束**（结果怎么校验）
> - **观测**（日志怎么落）
> - **降级**（依赖挂了怎么办）
>
> 它和 ReAct / Plan-and-Solve 是不同抽象层级 —— **ReAct 和 P&S 是 Harness 内部可选的'决策核'，Harness 是外面那层 OS**。"

### Q6.2 PharmaAlpha 的 Harness 6 个维度具体怎么实现的

#### 维度 1 · 输入约束（Input Harness）

| 机制 | 关键代码 | 防御什么 |
|------|---------|---------|
| ContextBuilder 标签分层 | `context_builder.py:33-138` | 上下文混乱 / 关键信息被淹没 |
| 两级截断（硬截断 + 按预算） | `context_builder.py:142-198` | Context window 爆炸 |
| Runtime Budget Guard | `pec_agent.py:258-287` | Tool Loop 累积爆 context |

**Runtime Budget Guard 的精妙处**：Tool Loop 中段检查累积 token，超 80% 预算时**保留最后一次 tool 结果完整**，把更早的 tool 消息做"头尾保留"截断（前 500 + `[...已截断]` + 后 500）。**不直接 pop 是因为 Function Calling 协议要求 `tool_call_id` 配对**。

#### 维度 2 · 决策约束（Decision Harness）

| 机制 | 关键代码 | 防御什么 |
|------|---------|---------|
| `response_format={"type":"json_object"}` | `pec_agent.py:146` | 自由文本无法解析 |
| `_normalize_llm_json_content` 三层防御 | `pec_agent.py:97-126` | LLM 返回脏 JSON |
| 双 ToolRegistry（exec vs synth） | `pec_agent.py:55-68` | Synthesize 阶段乱抓数据 |
| Prompt 数据源白名单 | `prompts.py:39-43` | 走错数据源（如用 fetch_webpage 抓财报） |

**`_normalize_llm_json_content` 三层防御**：
1. 去 markdown fence ` ```json `
2. 处理嵌套 JSON 字符串（`"\"{\\\"k\\\":1}\""` 这种）
3. 失败兜底返回 `{"error": ..., "raw": raw}`，**不抛异常**

**双 ToolRegistry 设计**：
- `_exec_registry`：13 个工具（行情/财报/网页/PDF/Memory/RAG/研报/画布）
- `_synth_registry`：仅 2 个画布工具
- **通过收窄工具集**减少 Synthesize 阶段的"幻觉式补抓数据"行为 —— LLM 看不到的工具就调不了

#### 维度 3 · 执行约束（Execution Harness）

| 机制 | 关键代码 | 防御什么 |
|------|---------|---------|
| `MAX_PEC_ROUNDS = 3` | `pec_agent.py:40` | Plan-Check 反复跑而不收敛 |
| `MAX_TOOL_LOOPS = 10` | `pec_agent.py:41` | 单轮 Execute 内 LLM 死循环调工具 |
| `timeout=120, max_retries=0` | `pec_agent.py:81` | SDK 重试与外层 PEC 重试冲突 |
| `[Tool Error]` 容错（不抛异常） | `registry.py:48-60` | 工具异常炸链路 |

**关键设计**：`max_retries=0` 是有意的 —— PEC 循环本身就是重试机制，再叠 OpenAI SDK 的自带重试会**双层叠加不可控**。把控重试边界是 Harness 工程的核心要点之一。

#### 维度 4 · 输出约束（Output Harness）

| 机制 | 关键代码 | 防御什么 |
|------|---------|---------|
| Check 阶段 LLM as Judge | `pec_agent.py:497-516` | 漏数据 / 答非所问 |
| Gaps 反馈到下一轮 Plan | `pec_agent.py:438-447` | 重试时无差异 |
| `passed=true` 立即 break | `pec_agent.py:519-521` | 浪费配额 |

**Gaps 反馈循环**是 Harness 的精髓 —— 不是简单重试，而是把 Check 阶段产出的"缺什么"作为**结构化信号**注入下一轮 Plan 的 short_term_memory，让 Plan 知道**增量做什么**而不是从头重来。

#### 维度 5 · 观测（Observability）

`_LLMFileLogger`（`tool_callable_agent.py:42-180`）按 session 落 jsonl 文件，记录 5 类事件：
- `llm_request`：messages + tools 摘要
- `llm_response`：内容 + 工具调用列表 + 耗时
- `tool_exec`：工具名 + 参数 + 结果 + 成功标志 + 耗时
- `error`：任何异常
- `finish`：会话结束原因 + 总轮次 + 总耗时

环境变量 `AGENT_LOG_VERBOSE=1` 才记录完整 messages，**默认只存预览**（content 截 240 字符）减少日志膨胀。

**Harness 体现**：黑盒 LLM 没有日志 = 没法迭代 prompt / 调整重试策略。

#### 维度 6 · 降级（Fallback）

| 机制 | 关键代码 | 防御什么 |
|------|---------|---------|
| Embedding 失败 → ILIKE 全文搜索 | `memory_tools.py:156-178` | Embedding API 失效系统挂 |
| 多 Provider 抽象（OpenAI/DashScope/Zhipu/BGE） | `embedding.py:165-191` | 单一 provider 故障 |
| 空 plan steps → 直答 Synthesize | `pec_agent.py:459-475` | 闲聊也跑工具循环 |

### Q6.3 Harness 总览图（**面试时画这张表**）

| 维度 | 机制 | 对应代码 | 防御风险 |
|------|------|---------|---------|
| **输入** | ContextBuilder 标签分层 | `context_builder.py` | 上下文混乱 |
| **输入** | 两级截断 | `context_builder.py:_apply_budget` | Context 爆炸 |
| **输入** | Runtime Budget Guard | `pec_agent.py:258-287` | Tool Loop 累积爆 |
| **决策** | json_object 强制输出 | `pec_agent.py:146` | 文本无法解析 |
| **决策** | JSON 三层鲁棒解析 | `pec_agent.py:97-126` | 脏 JSON |
| **决策** | 双 ToolRegistry | `pec_agent.py:55-68` | 工具滥用 |
| **决策** | 数据源白名单 | `prompts.py:39-43` | 走错源 |
| **执行** | 双层循环上限（3/10） | `pec_agent.py:40-41` | 死循环 |
| **执行** | timeout=120, retries=0 | `pec_agent.py:81` | 双层重试 |
| **执行** | `[Tool Error]` 容错 | `registry.py:48-60` | 异常炸链路 |
| **输出** | Check LLM as Judge | `pec_agent.py:497-516` | 漏数据 |
| **输出** | Gaps 反馈循环 | `pec_agent.py:438-447` | 重试无差异 |
| **输出** | passed 早停 | `pec_agent.py:519-521` | 浪费配额 |
| **观测** | jsonl 全链路日志 | `tool_callable_agent.py:42-180` | 黑盒不可定位 |
| **降级** | Embedding ILIKE 兜底 | `memory_tools.py:156-178` | API 挂系统挂 |
| **降级** | 多 Provider 抽象 | `embedding.py:165-191` | 单点故障 |
| **降级** | 空 plan 直答 | `pec_agent.py:459-475` | 闲聊跑工具 |

### Q6.4 Harness 答题三段式（60 秒口述）

> [!quote]+ 第一段（30 秒，给框架）
> "Harness 的本质是把 LLM 当成不可靠组件，外部用确定性代码包住。我从**输入约束、决策约束、执行约束、输出约束、观测、降级** 6 个维度做的。"

> [!quote]+ 第二段（60 秒，每维度举一个最有代表性的例子）
> "比如：
> - **输入约束**我做了 ContextBuilder 标签分层 + 两级截断
> - **决策约束**最关键的是 `response_format=json_object` + 三层 JSON 鲁棒解析
> - **执行约束**设了 PEC 3 轮 + Tool Loop 10 次双层熔断
> - **输出约束**用 Check LLM as Judge 把 gaps 反馈到下一轮 Plan，构成自迭代闭环
> - **观测**有 jsonl 全链路日志
> - **降级**有 embedding 失败时的 ILIKE 兜底"

> [!quote]+ 第三段（30 秒，反思）
> "当前 Harness 的弱点是 **Check 用同一个模型自己判自己（self-bias）**，改进方向是用更强模型当 judge 或加结构化 schema 校验。
>
> 另外重试策略只是把 gaps 注入 prompt，**没做错误分类**（rate-limit / 网络 / 数据不存在），未来会按错误码做差异化重试。"

### Q6.5 Harness vs ReAct vs Plan-and-Solve 抽象层级（避雷）

> [!danger] 不要把它们当同级概念比

正确说法：

```
┌──────────────────────────────────────────┐
│  Harness Engineering（OS 层）            │
│  ┌────────────────────────────────────┐  │
│  │  决策核 / 调度策略                 │  │
│  │   - ReAct                          │  │
│  │   - Plan-and-Solve                 │  │
│  │   - PEC（本项目用的）              │  │
│  │   - Reflexion                      │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

ReAct 和 P&S 是 **Harness 内部可选的"决策核"**，Harness 是外面那层负责"输入/输出/执行/观测/降级"的工程包装。

---

## 7. 容量评估 / 性能 / 量级（必备数字）

> [!warning] 没有数字 = 没做过项目
> 这部分是字节面试官最爱的"压你"问题。
> **自己跑一次端到端，把数字测出来，背下来**。下面的数字仅作模板，**不要直接照背**。

### Q7.1 一次完整请求的端到端延迟？

> [!important] 项目已内置端到端延迟打点，前端实时展示并累计 P50 / P95
>
> **不再依赖手动 `time.time()`**。系统在协议层新增了 `timing` 事件，由 PEC Agent 在每个关键阶段 emit，前端实时聚合并显示。

#### 打点架构

> [!example]+ 数据流
>
> ```
> Python PEC Agent
>   ├─ time.perf_counter() 包裹各阶段
>   ├─ emit Timing(phase, round, elapsed_ms, metadata)
>   └─ JSON Lines → stdout
>     ↓
> Next.js executor (子进程读取，按行 JSON.parse)
>     ↓ Server-Sent Events
> Next.js chat route (passthrough "timing" 事件)
>     ↓ SSE
> useChatStream hook
>   ├─ TimingEntry[] 累加到 message
>   ├─ buildTimingSummary() → byPhase / llmCalls / toolCalls
>   └─ 写到 ChatMessage.timingSummary
>     ↓
> 渲染层
>   ├─ PhaseBlock：标题旁 [3.2s]
>   ├─ ToolEventBadge：[200ms]
>   ├─ TimingPanel：消息底部完整 breakdown（折叠）
>   └─ TimingStatsBar：顶部跨会话 P50 / P95（localStorage 50 样本）
> ```

#### 打点点位（共 9 类）

| Phase            | 触发位置                                | metadata                                  |
| ---------------- | --------------------------------------- | ----------------------------------------- |
| `memory_recall`  | `_recall_memory()` 整体耗时             | `{hit: bool}`                             |
| `rag_search`     | `_pre_search_rag()` 整体耗时            | `{hit: bool}`                             |
| `plan`           | PEC plan 阶段从 `PhaseStart` 到 `PhaseEnd` | `{steps: int}`                            |
| `execute`        | execute 阶段含全部 tool loop            | —                                         |
| `check`          | check 阶段 LLM JSON 调用 + 校验           | `{passed: bool}`                          |
| `synthesize`     | synthesize 阶段全部                       | —                                         |
| `llm_call`       | 单次 LLM API 调用（json / stream）         | `{phase_owner, loop?, stream, text_chars, tool_calls}` |
| `tool_call`      | 单次工具执行                              | `{phase_owner, tool_name, success}`       |
| `total`          | session 结束总耗时                        | `{session_id, rounds}`                    |

> [!info] 关键设计
> - **`time.perf_counter()` 替代 `time.time()`**：单调时钟，不受 NTP 校时干扰，精度更高
> - **打点不阻塞业务**：emit Timing 事件就是 yield 一个 dataclass，序列化开销 < 10μs
> - **`metadata.phase_owner` 解决归属问题**：`llm_call` 和 `tool_call` 是嵌套事件，metadata 里写归属哪个 PEC 阶段，前端可按阶段聚合

#### 实测延迟（smoke test，1 轮 PEC 路径）

| 阶段           | 耗时    | 占比   |
| -------------- | ------- | ------ |
| memory_recall  | 812ms   | 2.7%   |
| rag_search     | 634ms   | 2.1%   |
| plan           | 3.26s   | 11.0%  |
| execute        | 15.30s  | 51.5%  |
| check          | 2.02s   | 6.8%   |
| synthesize     | 7.70s   | 25.9%  |
| **total**      | **29.7s** | **100%** |

LLM 调用占比 **27.4s / 29.7s ≈ 92%**，工具调用 312ms。**LLM 是绝对瓶颈，与单次请求模板预期一致**。

#### 答题模板

> [!quote]+ 标准答法
>
> "我们在 PEC Agent 里给每个阶段加了 `time.perf_counter()` 打点，通过 `Timing` 协议事件流式上报到前端。
> 实测下来，单次请求 P50 大约 **30 秒**，分布是这样的：
>
> - **LLM 调用占大头**（约 90%）：plan/check 用非流式 JSON 模式 1-3 秒，execute/synthesize 用流式调用 5-10 秒，多次 tool loop 累加后 execute 阶段一般 15-20 秒
> - **预检索阶段** ~ 1.5 秒：memory recall 跑一次 embedding+pgvector 查询（约 800ms），RAG pre-search 类似（约 600ms）
> - **工具执行** ~ 100-500ms：股票行情、网页抓取等
>
> 优化方向我们已经识别但没全做：
> 1. memory recall 和 rag pre-search 可以**并行**（asyncio.gather），省 ~600ms
> 2. plan 阶段可以做**语义级缓存**（query embedding LSH），命中能省 3 秒
> 3. execute 阶段的 tool 也可以并发执行，但要看 tool 之间是否有依赖
>
> 我们前端在浏览器 localStorage 里存了最近 50 次的耗时样本，能直接看 P50/P95，方便做回归对比。"

> [!warning] 不要直接背 30s
> 实际数字依赖：
> - **DeepSeek API 时延**（地理位置 + 模型负载）
> - **embedding provider**（OpenAI / DashScope / 本地 BGE 差距很大）
> - **数据库延迟**（pgvector 在 ANN 索引下 ~ 数十 ms，无索引顺序扫描可达秒级）
>
> **跑几次再背真实分位数**。

### Q7.2 Token 消耗？

> [!important] 已内置 token 用量打点，前端实时展示并累计 P50 / P95
>
> 协议层新增 `token_usage` 事件，从 LLM 响应的 `usage` 字段解析（DeepSeek 流式调用通过 `stream_options={"include_usage": True}` 在最后一个 chunk 拿到）。每次请求展示：
> - **Token 总览**：prompt / completion / cached / 总计
> - **按阶段拆分**：plan / execute / check / synthesize 各自占用
> - **每次 LLM 调用**：明细（如 `execute·L1·stream 8.4s · 5.9k tok (5.1k↑/0.8k↓ · cache 3.8k)`）
> - **缓存命中率**：DeepSeek 默认开启 prompt caching，重复 system prompt + RAG 前缀基本能命中

#### 实测分布（smoke test，1 轮 PEC 路径，5 次 LLM 调用）

| 阶段 (phase_owner) | 调用次数 | 总 tokens | prompt | completion | cached | 占比 |
| ------------------ | -------- | --------- | ------ | ---------- | ------ | ---- |
| execute            | 2        | 12,840    | 11,600 | 1,240      | 8,600  | 41.4% |
| synthesize         | 1        | 9,650     | 8,200  | 1,450      | 5,200  | 31.1% |
| plan               | 1        | 4,580     | 4,200  | 380        | 3,200  | 14.8% |
| check              | 1        | 3,920     | 3,800  | 120        | 2,900  | 12.6% |
| **合计**           | **5**    | **30,990** | **27,800** | **3,190** | **19,900** | **100%** |

- **缓存命中率：71.6%**（19.9k / 27.8k prompt）
- **DeepSeek 公开定价（2026.04）**：
  - cache-hit input: $0.028 / 1M
  - cache-miss input: $0.28 / 1M
  - output: $0.42 / 1M
- **单次成本**：$0.028×0.0199 + $0.28×0.0079 + $0.42×0.00319 ≈ **$0.00411**（≈ ¥0.029）

> [!info] 为什么比模板便宜
> 模板假设了 0% cache。实际 DeepSeek 默认开 prompt caching，**重复的 system prompt + memory 注入 + RAG 前缀**全是 cache-hit，成本能降一个数量级。

#### 答题模板

> [!quote]+ 标准答法
>
> "我们前端实时展示了每次请求的 token 用量。单次请求 P50 大约 **30k tokens**，分布特点是：
>
> - **execute 占大头**（约 40%）：tool loop 累积，第二次调用要带回上一轮的 tool_result 上下文
> - **synthesize 第二**（约 30%）：要把所有数据综合成最终答案，prompt 最长
> - **plan / check 各占 10%-15%**：相对短
>
> 重点是 **DeepSeek 默认开 prompt caching**，重复的 system prompt + memory + RAG 前缀都能命中，**实测 cache hit 率约 70%**。
>
> 按 DeepSeek 公开价格估算：单次请求成本约 **$0.004**（约 ¥0.03），比不带 cache 的预估便宜 5-6 倍。
>
> 优化方向：
> 1. **进一步提升 cache hit**：把变化频繁的内容（chat_history、tool_results）放到 prompt 末尾，把稳定内容（system / memory / RAG）放前面
> 2. **execute 的 tool_result 截断**：现在已经做了 head/tail 各 500 char 的截断，但还是会让 prompt 涨到 5k+，可以考虑做 LLM summarize
> 3. **cached_tokens 单独监控**：作为成本健康度指标，跌破 50% 就报警"

> [!warning] 不要直接背 30k
> 实际值依赖：
> - 用户对话长度（短对话可能只 5k，长对话能到 50k+）
> - 是否触发了 `_compact_text` / `runtime_budget_guard` 截断
> - 工具调用次数（每次 tool result 都会注入到下次 prompt）
>
> **跑真实场景再背数字**。

### Q7.3 怎么扩容到 1000 QPS？

**当前不是 1000 QPS 的设计**，但面试官就是要看你能不能**当场推**：

1. **瓶颈识别**：
   - LLM API（外部依赖）：DeepSeek 默认 RPM 60，**不可能撑 1000 QPS**
   - Postgres：单机写入 ~ 1k/s，读 ~ 5k/s，向量检索更慢
   - Python 单进程：Tool Loop 是同步的，单 worker 一次只能跑一个请求
2. **改造方案**：
   - LLM：申请企业版高 RPM 配额 + 多 provider fallback（DeepSeek 主、Qwen 备）+ 路由层做 weighted round-robin
   - 进程：Python uvicorn workers 横向扩展，每个 worker 处理 1 并发
   - DB：读写分离（主 + 多副本）+ 连接池
   - 向量：pgvector → Milvus（10w+ QPS）
   - 缓存：Plan 缓存（query 语义哈希）+ 工具结果缓存（如行情 5 秒 TTL）
3. **降级**：QPS 超阈值时关闭 RAG 预注入、降低 MAX_PEC_ROUNDS=1

---

## 8. 简历表达 / 雷区清单（面试前必看）

> [!danger]+ 雷区 1：避免夸大动词
>
> | 简历原文 | 风险 | 改写 |
> |---------|------|------|
> | "**自动**沉淀为可复用 Skills" | 实际是人工筛选，撒谎风险 | "建立 Workflow → Skill 的脚手架规范 + 人工评审 + 自动注入流水线" |
> | "**设计** Agent 双阶段架构" | 暗示主设计者，必被深挖 | 评估自己是否真的能扛住，否则改"参与设计 / 负责 X 模块" |
> | "**深入理解** Redis 核心机制" | 任何细节答不出就翻车 | "熟悉" / "掌握" 即可，留余地 |

> [!danger]+ 雷区 2：术语必须用对
>
> - **SPO 三元组** = Subject-Predicate-Object（知识图谱）。**不是 plan-execute-check**。
> - **ReAct** = Reason-Act-Observe 循环，**不是"边执行边修改"**。
> - **Plan-and-Solve** = 一次性出完整 plan，再分步执行。
> - **Harness Engineering** = 用确定性代码包住不可靠 LLM 的工程范式（重试 / 校验 / 工具裁剪 / fallback），**不是"规定 AI 边界"**。

> [!danger]+ 雷区 3：禁词清单
>
> | 禁词 | 替代说法 |
> |------|---------|
> | ❌ "**抄的**" | ✅ "参考了 X 项目" |
> | ❌ "**没考虑过**" | ✅ "当时聚焦在 X，这个问题留作后续优化，现在让我推一下应该是 Y" |
> | ❌ "**不太清楚**" 重复出现 | 一道题不会可以诚实，**整面 5 道不会就是劝退** |
> | ❌ "**90% 由 AI 生成**"（简历里写了这句） | 字节面试官**会重点验证你是不是只是 prompter**，每个细节都要能答上来。要么删掉这句，要么背熟项目所有细节。 |

> [!danger]+ 雷区 4："90% 由 AI 生成"的应对
>
> 如果面试官问 "你这个项目代码 90% 都是 AI 写的，你做了什么？" —— **必须有标准答案**：
>
> > "AI 生成代码，但**架构设计和组件边界是我定义的**。我做的是：
> > 1. 定义 PEC 三阶段循环 + Synthesize 终态的核心契约
> > 2. 设计三层记忆边界（短期/长期/知识各自的 lifecycle）
> > 3. 设计 ContextBuilder 的标签优先级 + 两级截断策略
> > 4. 在 AI 生成的代码上做 code review、改 bug、调参数（如混合检索三个权重的实际值是我调出来的）
> > 5. 测试与压测（这部分要有数字）
> >
> > AI 是我的 pair programmer，但产品决策 100% 是我做的。"

---

## 9. 面试前自检清单

### 必须能讲清楚（不看资料）：
- [ ] 30 秒电梯讲清 PharmaAlpha
- [ ] 画 PEC 整体架构图
- [ ] 三层记忆每层的存储 + 检索方式
- [ ] 混合检索打分公式 `similarity * 0.6 + freq * 0.2 + decay * 0.2`，每项归一化方式
- [ ] SPO 三元组 + 一个具体例子
- [ ] **数据库选型对比**：Postgres vs MySQL vs MongoDB（向量/JSON/混合查询三维度）
- [ ] **向量库选型对比**：pgvector vs Milvus vs Pinecone vs Qdrant vs Redis Vector
- [ ] **RAG 完整流水线 7 步**：parse → hash 去重 → 创建 doc → chunk → embed → store → 状态终态
- [ ] RAG 检索 SQL 长什么样（JOIN Document + status='ready' + ORDER BY embedding）
- [ ] ContextBuilder 的 5 个标签 + 装配顺序 + 两级截断 + 优先级三级表
- [ ] `phase_inject` 为什么放最后（recency bias）
- [ ] 预注入 vs LLM 自调工具的 tradeoff
- [ ] PEC 与 ReAct / Plan-and-Solve 的区别
- [ ] Harness 范式定义 + 6 个维度（输入/决策/执行/输出/观测/降级）
- [ ] Harness 与 ReAct/P&S 的抽象层级关系（Harness 是 OS，ReAct/P&S 是决策核）

### 必须有数字（自己测出来）：
- [ ] 端到端 P50 / P95 延迟
- [ ] 单次请求 token 消耗 + 成本
- [ ] Memory recall 平均耗时
- [ ] 当前数据规模（MemoryNode 多少条 / DocumentChunk 多少条）

### 必须有改进方向（每个组件 1-2 个）：
- [ ] PEC 的弱点 + 改进
- [ ] 三层记忆的弱点 + 改进
- [ ] ContextBuilder 的弱点 + 改进（标签粒度太粗、优先级硬编码、缺重要性评分）
- [ ] 工具调用层的弱点 + 改进
- [ ] Harness 的弱点 + 改进（self-bias judge、缺错误分类）
- [ ] RAG 的弱点 + 改进（无向量索引、无 BM25 混合检索、无 reranker）

---

## 10. 字节后端 Agent 方向常见追问 - 提前准备

| 类别 | 高频问题 | 你的简短答案要点 |
|------|---------|----------------|
| **Agent 范式** | ReAct vs Plan-and-Solve vs Reflexion 区别 | 决策粒度 + token 成本 + 错误恢复三维度对比 |
| **Memory** | 怎么决定一条信息存到长期记忆 | 当前是规则触发（实体被显式提及 + 用户确认），未来要做重要性打分 |
| **Memory** | 怎么处理用户偏好变化（之前喜欢 A 现在喜欢 B） | category=preference 同 subject 多版本，confidence + lastAccessAt 共同决定哪个生效 |
| **RAG** | top-k 的 k 怎么选 | 默认 top_k=5（memory）/ top_k=3（RAG），平衡召回率和上下文 |
| **RAG** | 长尾召回（rare query）怎么办 | 兜底 ILIKE 全文搜索（`_fallback_text_search`） |
| **多智能体** | 你这是单 agent，怎么扩成多 agent | 把 Plan/Execute/Check 拆成独立进程 + Message Queue 通信，但单进程更简单可控，**目前业务量没必要拆** |
| **稳定性** | LLM 输出不是合法 JSON 怎么办 | `_normalize_llm_json_content` 先去 markdown fence、再处理嵌套字符串 JSON、失败返回 `{"error": ..., "raw": ...}` |
| **可观测** | 怎么知道某次请求哪一步出错 | `_LLMFileLogger` 按 session_id 落文件，记录每轮 request/response/tool_exec/error，配合行号可以追溯 |

---

## 11. 临时复习提纲（面试前 2 小时刷一遍）

> [!important]+ T-2h 速过清单
> 按顺序刷下面 9 项，每项不超过 10 分钟。

1. **背公式**：
   - $\text{final\_score} = \text{similarity} \times 0.6 + \text{freq\_score} \times 0.2 + \text{decay} \times 0.2$
   - $\text{decay} = \exp(-0.693 \times \text{age\_days} / 30)$
   - $\text{freq\_score} = \min(\text{access\_count} / 20, 1)$

2. **背架构**：
   ```
   PLAN → EXECUTE → CHECK → (loop) → SYNTHESIZE
   ```
   每阶段一句话职责。

3. **背三层记忆**：
   ```
   短期（进程内 / 结构化拼接 / 单会话）
   长期（MemoryNode / SPO + embedding / 混合检索）
   知识（DocumentChunk / 递归分块 + pgvector / top-k）
   ```

4. **背 ContextBuilder 5 个标签**：
   ```
   system_prompt (角色) | env_context (memory/rag/runtime)
   chat_history (对话) | phase_inject (阶段指令，放最后利用 recency bias)
   tool_result (工具输出，先 2000 char 硬截断)
   ```

5. **背 Harness 6 个维度**：
   ```
   输入约束 → 决策约束 → 执行约束 → 输出约束 → 观测 → 降级
   每个维度准备 1-2 个最有代表性的机制
   ```

6. **背技术选型杀手锏**：
   ```
   Postgres：混合数据形态（关系+JSON+vector）一张表 + 一条 SQL 解决
   pgvector：业务需要"user_id 过滤 + 向量检索 + frequency 排序"的混合查询
            → SQL 一句话搞定，与主数据强一致，不需要双写
   1024 维：4KB/向量，10w 数据 400MB，性价比平衡点
   弱点要诚实：当前没建 HNSW 索引，10w+ 要加 vector_cosine_ops
   ```

7. **背 RAG 流水线 7 步**：
   ```
   parse → hash 去重 → 创建 Document(processing) → recursive chunk
   → batch embed → store DocumentChunk → 状态终态(ready/error)
   关键工程细节：file_hash 去重 / page metadata 引用 / 单条降级 / 120s 超时
   ```

8. **背一个具体故事**：你在做这个项目时遇到的一个真实 bug + 怎么修的（面试官问"你遇到过最难的问题"必备）

9. **准备一个反问**：
   - ✅ 推荐："字节内部做 Agent 平台时，怎么解决 LLM 输出稳定性问题？" 或 "团队对 ReAct vs PEC 的选型是怎么考虑的？"
   - ❌ 千万不要问："工资 / 加班"

---

> [!quote]+ 面试守则（最后一句话）
> **面试官不期待你什么都会**，但期待你**对自己写的项目 100% 负责**。
> 不会的就说不会，但**简历上写过的必须 100% 答得出来**。
>
> 这是诚信底线。

---

## 相关笔记（Obsidian Wiki Link）

- [[#3. 技术选型 + RAG 完整流水线（必问，技术深度集中考察点）|→ RAG 流水线一体化解析]]
- [[#6. Harness 工程范式实现专题（字节关心的前沿，必问）|→ Harness 6 维度速查]]
- [[#11. 临时复习提纲（面试前 2 小时刷一遍）|→ T-2h 复习提纲]]

