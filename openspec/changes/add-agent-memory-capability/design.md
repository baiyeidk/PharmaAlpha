## Context

当前仓库包含 Next.js 前后端与 Python agent runtime，已有多 agent 协作需求（planner、executor、evaluator），但投资建议 agent 缺少统一记忆层。现状问题是跨轮对话约束（预算、风险偏好、目标）容易丢失，导致回答重复澄清或与历史结论不一致。

该变更属于跨模块设计：
- Python agents 侧需要统一记忆接口与策略。
- API/上下文组装层需要支持检索注入与压缩摘要传递。
- 数据层需要支持记忆实体、索引、TTL 与审计字段。
- 方案希望优先复用开源记忆管理项目，降低自研成本。

## Goals / Non-Goals

**Goals:**
- 建立短期会话记忆与长期用户记忆的双层记忆模型（均保存并支持压缩）。
- 实现记忆写入、冲突更新、检索召回、上下文压缩的完整链路。
- 在多 agent 协作中共享压缩后的记忆上下文，降低 token 成本。
- 提供治理能力：过期清理、来源追踪与可审计性。
- 记忆能力对用户无感，不新增前端显式开关。

**Non-Goals:**
- 不实现跨用户共享的知识库型全局记忆。
- 不在首版引入复杂向量平台迁移（先兼容现有数据栈）。
- 不承诺零误差自动记忆，仍需保留可控回退与人工审阅入口。
- 不扩展到非投资建议 agent 的长期持久化记忆。

## Decisions

### Decision 1: 采用双层记忆模型（Session + Profile）
- Choice:
  - Session Memory: 仅绑定当前会话，保存临时事实、阶段结论与未决问题。
  - Profile Memory: 绑定用户主体，保存稳定偏好、长期约束与确认后的投资偏好信息。
- Rationale:
  - 兼顾即时推理和长期个性化，避免所有信息混在单一存储中。
- Alternatives considered:
  - 仅会话记忆：跨会话体验差。
  - 仅长期记忆：临时上下文污染高。

### Decision 1.1: 记忆能力先限定在投资建议 agent
- Choice:
  - 仅在投资建议 agent（含 planner/executor/evaluator）启用持久化记忆。
  - 其他 agent 在同一轮或同一循环中使用临时上下文，不启用长期持久化。
- Rationale:
  - 先控制影响范围，降低引入系统性副作用的风险。

### Decision 2: 采用结构化记忆写入而非原文全量存储
- Choice:
  - 写入字段包含 `type`, `fact`, `constraints`, `source_ref`, `confidence`, `updated_at`, `ttl`。
  - 原文仅保留来源引用，避免重复存储大段文本。
- Rationale:
  - 成本更低，检索更稳定，便于冲突检测。
- Alternatives considered:
  - 全量原文入库：实现简单但检索噪声高、成本高。

### Decision 3: 检索采用“规则筛选 + 语义相关性”混合策略
- Choice:
  - 先用硬条件筛选（用户、会话、TTL、类型），再做相关性排序。
  - 对预算、风险偏好等硬约束设置强制优先级。
- Rationale:
  - 先过滤再排序能提高稳定性并减少误召回。

### Decision 4: 多轮协作必须经过上下文压缩器
- Choice:
  - 每轮交接输出压缩对象：`facts`, `constraints`, `open_questions`, `decisions`, `evidence_index`。
  - 压缩器要求保留关键硬约束且输出一致性分数。
- Rationale:
  - 防止上下文膨胀，提升响应速度，保持信息完整度。

### Decision 5: 记忆治理前置
- Choice:
  - 默认不对普通业务字段做禁止写入。
  - 引入 TTL 与软删除清理任务。
  - 冲突更新采用“最新优先”策略。
- Rationale:
  - 满足当前产品诉求（无感使用、少约束），同时保留基本治理能力。

### Decision 6: 优先集成开源记忆管理项目
- Choice:
  - 首选 `mem0` 作为主集成方案，使用其检索/记忆管理能力。
  - 参考 `langmem` 的 hot-path/background 记忆模式进行流程设计。
  - 保留抽象层，允许后续切换到 Letta/Zep 等方案。
- Rationale:
  - 开源方案成熟度高，可缩短实现周期并降低维护成本。

## Risks / Trade-offs

- [错误记忆被反复召回] -> 通过 `confidence`、来源权重和纠错覆盖策略降低影响。
- [压缩导致信息遗漏] -> 对预算、风险等级、用户显式偏好设置强制保留并加校验。
- [记忆召回延迟变高] -> 建立索引与分层缓存，限制每次注入条目数量。
- [开源项目升级导致接口不兼容] -> 通过适配器层隔离三方 SDK，固定版本并增加回归测试。
- [无敏感过滤策略带来合规争议] -> 在部署策略中保留可配置过滤钩子，默认关闭。

## Migration Plan

1. 定义记忆数据模型与仓储接口，新增迁移脚本与索引。
2. 在 `agents/base/` 增加记忆服务抽象（write/read/search/compress/prune）。
3. 引入开源记忆组件（优先 mem0）并通过适配器接入 `agents/base/`。
4. 接入 planner、executor、evaluator 的读写点与交接压缩器。
5. 在 API 层增加内部记忆参数与可观测字段（命中数、注入 token 量）。
6. 加入治理流程（TTL 清理、冲突更新、审计事件）。
7. 完成单元/集成测试后灰度发布，默认对投资建议 agent 新会话开启。

Rollback strategy:
- 配置级关闭记忆注入与写入，回落到无记忆模式。
- 保留数据结构不删除，避免快速回滚时丢失历史。

## Open Questions

- 记忆数据保留周期是否采用统一默认值，还是按环境区分？
