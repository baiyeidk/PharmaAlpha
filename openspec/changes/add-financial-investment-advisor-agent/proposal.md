## Why

当前项目已有通用对话与员工投资团队能力，但缺少一个可直接面向投资建议场景的统一 Agent：能够基于用户目标、风险偏好与持仓信息给出结构化建议。现在补齐该能力，可以让产品从“通用问答”升级到“可执行的投资建议流程”，并复用现有 Agent 基础设施与前端工作台。

## What Changes

- 新增一个金融投资建议多 Agent 协作系统，包含 planner、executor、evaluator 三个角色。
- planner 将用户问题拆解为可执行计划，覆盖财报提取、正负面新闻检索、股票趋势获取等步骤。
- executor 执行 planner 产出的计划，进行多工具调用与 skills 调用，汇总证据并生成候选答案。
- evaluator 审核 executor 输出的正确性、信息完备性与需求匹配度（例如预算约束），决定是否触发下一轮补充执行。
- 系统支持多轮 planner-executor-evaluator 迭代，最终向用户输出经过审核的建议结果。
- 增加建议生成流程：机会识别、风险评估、资产配置建议、行动清单与复盘建议。
- 定义建议输出格式与解释性要求（关键假设、风险提示、置信度/不确定性说明）。
- 接入当前系统中的会话、流式输出与 Agent 注册机制，保证可在现有 Dashboard 中直接使用。
- 引入基础防护规则：非个性化免责声明、超出能力边界时降级回答、缺失关键信息时先澄清再建议。
- 为 Agent 增加工具层能力：读文件（文本/PDF/图片）、搜索、股票趋势获取、skills 动态加载。
- 补充建议型工具：风险评估、组合建议、合规护栏执行、调用链审计记录。

## Capabilities

### New Capabilities
- `investment-advisory-agent`: 面向投资建议场景的端到端对话能力，产出结构化建议与风险说明。
- `investment-recommendation-safety`: 投资建议安全与合规护栏能力，包括免责声明、边界控制与信息不全时的澄清策略。
- `investment-advisory-tooling`: 投资建议 Agent 的工具编排能力，覆盖基础信息获取、趋势分析、skills 管理与审计可观测。
- `investment-multi-agent-collaboration`: planner/executor/evaluator 多角色协作能力，支持计划执行与评估回路。

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `agents/` 下新增投资建议 Agent 实现与配置。
  - `agents/base/` 与能力编排层将新增/扩展工具调用接口。
  - 新增或扩展多 Agent 编排层（计划、执行、评估、重试与终止条件）。
  - `src/lib/agents/` 可能需要扩展 Agent 注册与参数映射。
  - `src/app/(dashboard)/` 与相关 hooks 可能需要补充投资建议输入项与展示组件。
- APIs:
  - 复用现有聊天与 Agent 调用 API，必要时扩展请求参数结构。
- Dependencies/Systems:
  - 复用现有 Python Agent runtime、SSE 流式机制与数据库会话存储。
  - 若启用行情或研究数据，将新增外部数据源适配（可分阶段实施）。
