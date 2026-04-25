# PharmaAlpha 真实项目实现迁移计划

## 背景

当前仓库已经不是一个纯前端原型：

- 聊天、画布、RAG、认证、Prisma 持久化、Python Agent 执行链都已经存在。
- `employee-investment` 也已经具备员工画像、技能、SOP、工作流草稿、节点编辑和执行接口。

但当前 `investment-team` 的产品表达和系统语义仍然偏向 demo：

- 页面主入口还是 `workflow-first`。
- 团队协作、风险推演、通知闭环更多是展示层表达。
- demo 员工虽来自数据库，但仍是演示数据集。
- 工作流执行结果还没有沉淀为真正的项目级资产。

这意味着下一阶段不应该继续做“前端纠偏”，而应该把现有基础设施收敛成一个真实可运行的项目系统。

## 目标

把当前系统从“可演示的工作流页面”升级为“真实的医药投资协作项目平台”。

迁移后的核心原则：

1. 项目是顶层容器，不再让 workflow 成为默认入口。
2. 项目成员可以直接围绕项目对话、协作、沉淀结论。
3. Skill 和 SOP 是员工个人能力资产，不是产品一级导航。
4. Workflow 是一次 skill session 的运行态，而不是整个项目本身。
5. 每次执行都应沉淀为可追溯、可复用、可再输入的项目资产。
6. 风险推演、通知闭环、团队协作要逐步从前端表达迁移为真实后端能力。

## 推荐落地策略

不要一次性重写整个 `investment-team`。更稳妥的路径是先打通一条真实纵向链路：

1. 创建一个真实项目。
2. 项目自动拥有主会话和主看板。
3. 项目成员能共享访问这个项目。
4. 在项目内发起一次 skill session。
5. session 执行后生成一个 `ProjectArtifact`。
6. 资产回到项目看板和资产列表。
7. 后续 session 可以选择这个资产作为输入。

这条链路跑通后，再补风险推演和通知闭环。原因是风险推演、通知、员工画像更新都依赖项目上下文和资产模型；如果先做这些亮点模块，很容易再次变成前端展示逻辑。

## 当前基础

### 已有可复用能力

- 聊天会话与消息持久化：`Conversation`、`Message`
- 看板能力：`CanvasNode`、`CanvasEdge`
- 文档/RAG：`Document`、`DocumentChunk`
- 员工画像与技能：`EmployeeProfile`、`SkillDefinition`、`SkillSop`、`SkillScript`
- 工作流草稿与执行：`WorkflowDraft`、`WorkflowNode`、`WorkflowExecution`
- 项目与成员关系：`InvestmentProject`、`InvestmentProjectMember`
- Agent 运行桥接：`src/lib/employee-investment/agent.ts`

### 当前主要问题

1. 顶层用户心智仍然是“先建 workflow，再围绕 workflow 工作”。
2. `InvestmentProject` 已存在，但没有真正成为主入口和主语义。
3. 项目对话、项目看板、项目产物之间还没有完整闭环。
4. skill 执行结果没有统一沉淀为项目资产。
5. 风险推演与通知能力还停留在展示态，没有进入统一模型。

### 需要保留的兼容性

当前已有 workflow 接口和页面逻辑仍然有价值，不建议直接删除。

保留原则：

- 旧的 workflow 接口可以继续服务现有页面，但新开发优先走 project/session/artifact 接口。
- `WorkflowDraft` 不废弃，只改变业务语义：它是一次 session 的运行态草稿。
- 旧数据如果没有 `investmentProjectId`，可以显示为“个人历史 workflow”，不要强行迁移成项目。
- `investment-team/page.tsx` 可以先作为过渡页，等项目主接口稳定后再重构主界面。

### 展示期访问策略

当前阶段偏比赛展示和产品验证，项目访问默认开放给已登录用户。

具体约定：

- `InvestmentProjectMember` 继续保留，用于展示项目负责人、成员和后续真实权限。
- 默认不把成员关系作为访问门禁，方便演示和联调。
- 如需恢复严格项目权限，设置 `EMPLOYEE_PROJECT_ACCESS_OPEN=false`。
- 即使默认开放，接口仍要求登录态，避免完全匿名访问内部数据。

## 目标模型

### 1. Project 成为顶层对象

一个项目至少包含：

- 基本信息：标题、主题、目标、优先级、状态
- 项目负责人
- 项目成员
- 主会话
- 主看板
- 项目资产列表
- 最近的 skill sessions

用户进入系统后，优先进入项目，而不是直接进入 workflow 编辑页。

### 2. Project Conversation

每个项目拥有一个主对话线程。

作用：

- 日常分析讨论
- 任务分派
- 追问与上下文延续
- 结论确认
- 驱动新一轮 skill session

要求：

- 项目成员共享访问权限
- 对话不依赖 skill 才能进行
- 对话结果可选择沉淀到看板或资产

实现建议：

- 复用现有 `Conversation`、`Message`、`CanvasNode`、`CanvasEdge`。
- `Conversation.userId` 继续保留为创建者或项目负责人。
- 项目会话的访问控制不要只看 `Conversation.userId`，而应通过 `InvestmentProjectMember` 判权。
- 一个项目先只绑定一个主会话；后续如需分支讨论，再引入 conversation kind 或 thread 概念。

### 3. Skill Session / Workflow Session

工作流保留，但语义调整为“项目中的一次技能执行会话”。

一次 session 由这些要素组成：

- 所属项目
- 发起员工
- 来源 skill
- 选定 SOP
- 输入资产
- 运行态 workflow
- 执行结果
- 最终产物

要求：

- session 内编辑不会直接修改 skill 定义
- 只有用户明确选择“更新为当前流程”时才回写 skill
- session 执行必须输出项目资产

### 4. Project Artifact

项目资产是后续闭环的核心对象。

建议新增统一资产模型，支持：

- `markdown`
- `text`
- `image`
- `summary_table`
- 后续可扩展 `report`、`risk_snapshot`、`decision_note`

每个资产必须记录：

- 所属项目
- 来源员工
- 来源 skill / SOP
- 来源 session
- 输入资产引用
- 内容主体
- 元数据

建议把资产和“执行实例”关联，而不只和“工作流草稿”关联。`WorkflowDraft` 描述的是运行结构，`WorkflowExecution` 才代表一次真实执行。资产来源最好同时记录 draft 和 execution：

- `workflowDraftId` 用于追溯使用了哪套流程。
- `workflowExecutionId` 用于追溯哪次运行产生了这个资产。
- `createdByEmployeeProfileId` 用于表达谁发起或确认了这个资产。

### 5. Risk Simulation 成为真实能力

风险推演不再只是页面卡片，而是项目级服务能力。

目标能力：

- 事件模板管理
- 场景参数输入
- 历史案例检索
- 推演结果计算/生成
- 风险快照沉淀为资产
- 风险结论进入通知与协作链路

风险推演的第一版不需要做完整预测系统。建议先实现“模板化场景 + 证据检索 + LLM 结构化推理 + 资产沉淀”：

- 模板提供输入参数和输出结构。
- RAG 检索历史案例和项目内资产。
- Agent 生成结构化影响评估。
- 结果保存为 `risk_snapshot` 类型资产。

## 分阶段实施计划

## Phase 0：统一语义与边界

目标：停止继续加深 demo 语义，先把真实语义定准。

交付：

- 明确 `project-first` 作为唯一目标方向
- 固化 `WorkflowDraft = skill session runtime draft`
- 固化“所有执行结果都要落资产”的约束
- 更新 `AGENTS.md` 和相关计划文档

完成标志：

- 新开发不再把 workflow 当成顶层产品对象
- 新页面/接口命名开始围绕 project、session、artifact 对齐

## Phase 1：数据模型补齐

目标：让数据库结构能支撑真实项目协作。

建议改动：

1. 给 `Conversation` 增加 `investmentProjectId`
2. 新增 `ProjectArtifact`
3. 给 `WorkflowDraft` 增加 session 语义字段
4. 给 `WorkflowExecution` 增加最终资产引用，或通过 `ProjectArtifact.workflowExecutionId` 反查
5. 如有必要，为看板节点增加与项目资产的弱关联

建议字段：

### Conversation

- `investmentProjectId`
- `conversationType`，可选，默认 `personal`，项目主会话可标记为 `project_main`

### ProjectArtifact

- `id`
- `investmentProjectId`
- `createdByEmployeeProfileId`
- `workflowDraftId`
- `workflowExecutionId`
- `skillDefinitionId`
- `skillSopId`
- `artifactType`
- `title`
- `content`
- `attachments`
- `inputArtifactIds`
- `metadata`
- `createdAt`
- `updatedAt`

### WorkflowDraft

- `sessionType`
- `skillDefinitionId`
- `skillSopId`
- `sourceConversationId`
- `finalArtifactId`

### WorkflowExecution

- `finalArtifactId`
- `inputArtifactIds`
- `executionContext`

完成标志：

- Prisma schema 能表达项目、主会话、session、资产之间的关系
- 数据迁移可在本地成功执行
- 旧 workflow 数据仍然可以被读取，不会因为缺少项目字段而报错

## Phase 2：权限与项目主链路

目标：让项目真正可用，而不是只存在表结构。

交付：

- 项目创建接口
- 项目成员邀请/加入接口
- 项目详情接口
- 项目主会话权限控制
- 项目主看板读取权限控制

关键点：

- 普通 `Conversation` 继续按 `userId` 控制。
- 项目 `Conversation` 默认对已登录用户开放，展示期不强制成员判权。
- 当 `EMPLOYEE_PROJECT_ACCESS_OPEN=false` 时，项目 `Conversation` 改为按 `InvestmentProjectMember` 判权。
- 画布接口如果通过 `conversationId` 访问，也必须复用同一套项目会话访问策略。
- 项目成员状态至少区分 `active`、`invited`、`removed`

完成标志：

- 一个项目可被多个成员访问
- 成员可以共享看到同一条项目对话和同一块项目看板
- 非成员访问项目会话、看板、资产时返回 403

## Phase 3：项目主界面重构

目标：把当前 `investment-team` 从 workflow 编辑页改成项目工作台。

页面结构建议：

1. 项目概览
2. 项目对话
3. 团队成员与技能
4. 项目看板
5. 资产列表
6. 最近 sessions
7. 风险推演

约束：

- 默认不展示 workflow 编辑器
- 只有在进入某个 skill session 时才展开 workflow 面板
- 项目主页不再把节点编辑作为第一屏核心任务
- 资产和对话应是项目主页的主要工作对象

完成标志：

- 用户先看到“项目”，而不是“workflow”
- 对话、看板、资产和 session 的关系在 UI 上清晰可见

## Phase 4：Skill Session 正式化

目标：让 skill 执行变成真实、可追踪、可回写的项目行为。

交付：

- 在项目内发起 skill session
- 从个人 skill/SOP 复制出 runtime workflow
- 支持输入资产选择
- 执行结束生成主资产
- 支持“更新为当前流程”回写 skill 定义

执行上下文至少包含：

- 项目基本信息
- 项目成员及其角色
- 发起员工画像
- 选定 skill / SOP
- 输入资产正文与摘要
- 项目主会话最近上下文
- 相关 RAG 检索结果

完成标志：

- 用户能在项目中启动一次 session
- session 结果会自动形成资产并回到项目上下文
- session 详情页能看到输入、流程、执行事件、输出资产

## Phase 5：风险推演后端化

目标：把竞赛亮点转成真实功能。

交付：

- 风险事件模板
- 场景输入接口
- 历史案例检索
- 推演执行链路
- 结果结构化输出
- 风险资产落库

优先支持场景：

1. 集采政策影响
2. 竞品获批影响
3. 临床失败影响

第一版只需要完整打通一个场景。建议优先做“集采政策影响”，因为它更容易参数化：

- 公司或产品
- 受影响收入占比
- 预期降价幅度
- 可替代产品
- 历史可比案例
- 置信度与不确定性说明

完成标志：

- 用户可在项目内发起一条真实推演
- 推演结果可复查、可复用、可引用
- 推演结果作为资产进入项目资产列表，而不是只展示在页面卡片中

## Phase 6：通知与反馈闭环

目标：让系统输出进入真实组织协作。

交付：

- 通知目标映射
- 关键结论推送
- 成员反馈回收
- 反馈写回项目和员工画像

第一版建议先做站内通知，不要直接接外部社交平台。

原因：

- 站内通知可以验证通知对象、通知内容、阅读状态、反馈写回。
- 外部 webhook、权限、失败重试、消息格式适配会显著增加复杂度。
- 等站内闭环稳定后，再把 `EmployeeSocialAccount` 用作外部通知映射。

完成标志：

- 结论不再停留在页面面板
- 系统具备“输出 - 反馈 - 更新画像”的闭环

## API 重构建议

优先新增而不是继续堆叠 workflow-only 接口。

建议新增一组项目主接口：

- `POST /api/employee-investment/projects`
- `GET /api/employee-investment/projects`
- `GET /api/employee-investment/projects/:projectId`
- `POST /api/employee-investment/projects/:projectId/members`
- `GET /api/employee-investment/projects/:projectId/artifacts`
- `POST /api/employee-investment/projects/:projectId/artifacts`
- `POST /api/employee-investment/projects/:projectId/sessions`
- `GET /api/employee-investment/projects/:projectId/sessions`
- `GET /api/employee-investment/sessions/:sessionId`
- `POST /api/employee-investment/sessions/:sessionId/execute`
- `POST /api/employee-investment/sessions/:sessionId/promote-to-skill`

在项目接口稳定后，再逐步让旧的 workflow 接口退居 session 子接口。

建议新增公共判权 helper：

- `getEmployeeProjectAccess(session, projectId)`
- `assertEmployeeProjectAccess(session, projectId)`
- `getProjectConversationAccess(session, conversationId)`

这样 chat、canvas、artifact、session 接口可以复用同一套项目权限规则。

## 页面与实现顺序建议

建议按这个顺序落地，而不是从风险推演或前端视觉先入手：

1. 数据模型
2. 权限与项目主链路
3. 项目页面主结构
4. session 与资产闭环
5. 风险推演
6. 通知闭环

原因：

- 没有项目、权限、资产模型，后续能力都只能继续停留在展示态。
- 先补主链路，后做亮点模块，才能避免再次回到“前端写死的竞赛壳”。

## 验收标准

满足以下条件，才算完成“真实项目实现”的第一阶段：

1. 项目成为唯一主入口。
2. 多成员可共享访问同一项目上下文。
3. 项目对话与看板真实共享。
4. skill 执行以 session 形式存在。
5. 每次执行都能生成项目资产。
6. 资产可被后续 session 重新引用。
7. 风险推演至少有一个真实后端链路可跑通。
8. 前端不再依赖静态展示补齐核心业务能力。

## 第一阶段最小可交付版本

第一阶段不需要覆盖全部竞赛叙事，重点是证明系统已经从 demo 进入真实项目模型。

最小范围：

1. 新建项目。
2. 查看项目详情。
3. 项目自动创建主会话。
4. 项目成员能访问主会话。
5. 项目内发起一个 skill session。
6. session 执行后生成一个 markdown 资产。
7. 项目资产列表展示该资产。
8. 再次发起 session 时可选择该资产作为输入。

这一版可以暂时不做：

- 完整外部通知
- 多风险场景
- 复杂成员邀请流程
- 资产版本树
- 项目内实时多人协同

## 测试与验证建议

需要补的测试不应只测页面是否渲染，而要覆盖真实业务边界：

- 项目成员可以访问项目会话，非成员不能访问。
- 创建项目时会创建 initiator 成员关系。
- 创建项目时会创建或绑定主会话。
- 创建 session 时会复制 skill/SOP 的运行态配置。
- 执行 session 后会产生 `WorkflowExecution` 和 `ProjectArtifact`。
- 资产可以作为后续 session 输入。
- 旧 workflow 接口在无项目字段时仍可读取历史数据。

## 风险与取舍

### 1. `Conversation` 继续强依赖 `userId`

现有 `Conversation.userId` 是必填字段。短期可以保留它作为创建者字段，同时用 `investmentProjectId` 和项目成员表做共享访问控制。不要在第一阶段把整个聊天权限模型推倒重做。

### 2. `CanvasNode` 仍然挂在 `conversationId`

这是可接受的。项目主看板可以通过项目主会话间接拥有。第一阶段不用新增 `ProjectCanvas`，否则会拆散现有画布能力。

### 3. `ProjectArtifact.inputArtifactIds` 用 Json 起步

第一版用 Json 存字符串数组足够。等资产依赖查询、版本树、血缘分析变复杂后，再拆独立关联表。

### 4. 风险推演先做结构化生成，不急着做数值模型

竞赛和产品都需要可信解释，但第一版不应陷入复杂预测模型。先保证输入、证据、推理、输出、资产沉淀链路真实。

### 5. 通知先站内，后外部

外部通知会引入平台适配和交付可靠性问题。先做站内通知可以更快验证闭环。

## 当前不建议做的事

- 继续扩大 `investment-team/page.tsx` 的前端展示拼装
- 再增加更多仅 UI 可见、没有后端模型支持的“能力区块”
- 把新需求继续塞进 `workflow-first` 心智里
- 为了赶展示而绕开项目权限和资产模型

## 决策摘要

下一阶段的核心不是“再优化页面”，而是：

把现有聊天、画布、员工画像、工作流、Agent、Prisma 基础设施统一收敛为一个 `project-first` 的真实协作产品。

如果这个方向不先落地，系统会持续停留在“后端有一些真能力，但产品形态仍然像 demo”的状态。

更具体地说，下一步最合理的工程任务是：

1. 补齐项目、会话、session、资产的数据关系。
2. 建立统一项目判权 helper。
3. 新增项目主接口。
4. 让一次 skill session 真实产出项目资产。
5. 再重构 `investment-team` 页面去消费这条真实链路。

## 补充：团队协作产品表达

当前“选择技能”容易被理解为选择一个工程流程。更合理的协作语义是：用户不是选择技能本身，而是在项目中把一个研究任务交给具备某项能力的成员。

建议把 `Skill Session` 的产品表达升级为 `Team Task / 协作任务`：

1. 选择负责人或参与成员。
2. 展示该成员的技能、SOP、关注领域。
3. 选择输入项目资产。
4. 创建协作任务。
5. 执行任务并跟踪状态。
6. 将输出沉淀为 `ProjectArtifact`。
7. 由其他项目成员 review、评论或确认。

对应关系：

- Member = 谁来做。
- Skill = 他能做什么。
- SOP = 他怎么做。
- Session / WorkflowDraft = 这一次任务。
- WorkflowExecution = 这一次运行。
- ProjectArtifact = 任务产出。

这样团队协作不再只是“项目有多个成员”，而是能看到谁负责什么、基于哪些材料、产生了什么结论、其他成员如何反馈。

第一阶段可以先不做复杂实时协同，但至少要让 UI 呈现：

- 成员能力矩阵。
- 任务卡片。
- 任务负责人。
- 输入和输出资产。
- 状态和失败原因。
- 执行 prompt。

这比继续强化 workflow-first 编辑器更符合真实投资团队协作心智。
