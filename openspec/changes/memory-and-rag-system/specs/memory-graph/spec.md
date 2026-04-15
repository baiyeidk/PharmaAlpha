## ADDED Requirements

### Requirement: MemoryNode 图结构存储

系统 SHALL 使用 `MemoryNode` 模型存储记忆，采用三元组结构（subject / predicate / object）。每个 MemoryNode MUST 关联 userId，支持 category 分类（entity / conclusion / preference / event），并可选附带 embedding 向量。

#### Scenario: 存储股票实体记忆
- **WHEN** LLM 提取出 `{ category: "entity", subject: "恒瑞医药", predicate: "股票代码", object: "600276" }`
- **THEN** 系统创建一条 MemoryNode，embedding 字段存储 "恒瑞医药 股票代码 600276" 的向量

#### Scenario: 存储投资结论记忆
- **WHEN** LLM 提取出 `{ category: "conclusion", subject: "恒瑞医药", predicate: "投资评级", object: "创新药龙头，长期看好，短期承压" }`
- **THEN** 系统创建一条 MemoryNode，confidence 记录 LLM 给出的置信度

### Requirement: MemoryEdge 关系连接

系统 SHALL 使用 `MemoryEdge` 模型连接相关的 MemoryNode。relation 类型 MUST 包含 `belongs_to`（归属）、`analyzed_in`（分析于某次对话）、`compared_with`（对比关系）。

#### Scenario: 关联同一公司的多条记忆
- **WHEN** 用户在不同对话中多次分析"恒瑞医药"
- **THEN** 各次分析结论 MemoryNode 通过 `analyzed_in` edge 关联到实体 MemoryNode

#### Scenario: 对比关系记录
- **WHEN** 用户要求对比"恒瑞医药"和"药明康德"
- **THEN** 两个实体 MemoryNode 之间创建 `compared_with` edge

### Requirement: LLM 结构化记忆提取

系统 SHALL 在每次对话结束后（SSE 流 flush 阶段），异步调用 DeepSeek LLM 从助手回复中提取结构化记忆。提取结果 MUST 为 JSON 数组格式。提取失败 MUST NOT 影响用户对话体验。

#### Scenario: 正常提取
- **WHEN** 助手完成了对"江中药业 600750"的分析回复
- **THEN** LLM 提取出至少包含 `{ subject: "江中药业", predicate: "股票代码", object: "600750", category: "entity" }` 的记忆条目

#### Scenario: 提取失败降级
- **WHEN** LLM 提取调用失败（超时/返回非法 JSON）
- **THEN** 记录 error 日志，不写入任何记忆，用户无感知

#### Scenario: 空对话不提取
- **WHEN** 助手回复内容长度小于 50 字符（如简单问候回复）
- **THEN** 跳过记忆提取，不调用 LLM

### Requirement: 向量语义检索

系统 SHALL 提供 `memory.recall` tool，使用 pgvector 余弦相似度搜索与用户查询语义相关的记忆。检索 MUST 支持 top_k 参数（默认 5）。

#### Scenario: 语义检索相关记忆
- **WHEN** 用户问"之前分析过哪些医药股"
- **THEN** `memory.recall` 通过向量相似度返回所有 category=entity 且 subject 涉及医药公司的 MemoryNode

#### Scenario: 无 embedding 降级到结构化查询
- **WHEN** MemoryNode 的 embedding 字段为 null（embedding 写入失败的记录）
- **THEN** 该条记忆通过 subject/category 文本匹配参与检索，不被完全忽略

### Requirement: 记忆衰减与访问计数

每次记忆被检索命中时，系统 SHALL 递增 `accessCount` 并更新 `lastAccessAt`。检索排序 MUST 综合考虑向量相似度分数、`accessCount`（频率权重）和 `lastAccessAt`（时间衰减）。

#### Scenario: 高频访问记忆排序靠前
- **WHEN** "恒瑞医药" 实体被访问 10 次，"药明康德" 被访问 1 次，两者向量相似度相近
- **THEN** "恒瑞医药" 排在结果前面

#### Scenario: 长期未访问记忆衰减
- **WHEN** 某条记忆 30 天未被访问，另一条 1 天前被访问，两者向量相似度相近
- **THEN** 近期访问的记忆排序靠前

### Requirement: Plan 阶段自动记忆注入

PEC Agent 在 Plan 阶段开始前，MUST 自动用用户最新消息做一次 `memory.recall`，将检索到的相关记忆注入为 `env_context`（通过 ContextBuilder）。

#### Scenario: 自动注入历史分析记忆
- **WHEN** 用户发送"继续分析恒瑞医药"
- **THEN** Plan 阶段的上下文中自动包含之前关于恒瑞医药的实体和结论记忆

#### Scenario: 无相关记忆时不注入
- **WHEN** 用户发送的消息与已有记忆无语义关联
- **THEN** 不注入任何记忆内容，不影响 Plan 阶段正常执行

### Requirement: ConversationSummary 情景记忆

系统 SHALL 在对话自动摘要时（summarizer.ts），同步将摘要内容写入 `ConversationSummary` 表，并生成 embedding。后续新对话可通过向量检索找到相关的历史对话摘要。

#### Scenario: 摘要持久化
- **WHEN** 对话历史触发自动摘要（超过 token 预算的 50%）
- **THEN** 摘要内容写入 ConversationSummary，embedding 字段存储摘要文本的向量

#### Scenario: 跨对话上下文召回
- **WHEN** 新对话中用户提到"上次分析的那个药企"
- **THEN** memory.recall 可以检索到包含相关药企分析的 ConversationSummary

### Requirement: SessionMemory 数据迁移

系统 SHALL 提供迁移脚本，将现有 `SessionMemory` 表的数据转换为 `MemoryNode` 格式。迁移完成后 MUST 验证新表数据条数，确认无丢失后方可删除旧模型。

#### Scenario: 迁移 entity 类型
- **WHEN** SessionMemory 中存在 `{ category: "entity", key: "恒瑞医药", value: "600276" }`
- **THEN** 迁移为 MemoryNode `{ category: "entity", subject: "恒瑞医药", predicate: "股票代码", object: "600276" }`

#### Scenario: 迁移数据验证
- **WHEN** 迁移脚本执行完成
- **THEN** MemoryNode 条数 >= 原 SessionMemory 条数，不足则终止并报错
