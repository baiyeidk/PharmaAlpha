# 团队协作型项目看板 + 员工 Skill Session 方案

## 背景

当前 `employee-investment` 模块仍然是 `workflow-first`：

- 用户先输入一个 `topic`
- 系统立刻生成一张 workflow
- 页面围绕这张 workflow 去编辑和执行

这个结构适合 demo，但不适合“项目协作”。

核心问题：

1. 项目一开始就被绑定成一张大 workflow，不符合真实团队围绕话题逐步推进的方式。
2. 不同员工无论职位、画像、职责差异如何，最后都被塞进同一张 workflow 里，个人 skill 的边界不清晰。
3. 员工在项目中有两类动作：
   - 直接和 AI 对话，推进项目讨论
   - 基于自己的 skill 发起一次结构化执行
   当前系统只突出第二类，第一类没有被明确建模。
4. 项目中的看板产物和 skill 运行结果之间缺少明确约束，难以形成协作闭环。

因此需要把整体模型改成 `project-first`：

- 项目先存在
- 第一个发起对话的人就是项目负责人
- 项目负责人可以把其他员工拉进团队
- 项目成员可以直接在项目里和 AI 对话，不必先调用 skill
- 只有当成员明确选择某个 skill 时，才展开一个独立的 skill session workflow
- skill 运行结果必须沉淀为项目看板上的产物

## 现有可复用实现

这次改造不应该推翻已有“对话 + 看板”能力，而是要复用现有链路。

### 已有对话链路

- `Conversation`
- `Message`
- `src/components/chat/chat-view.tsx`
- `src/hooks/use-chat-stream.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/chat/history/route.ts`

现状：

- 已经支持创建会话、保存消息、按 `conversationId` 拉历史。
- 当前权限模型是单用户拥有一个 conversation。

### 已有看板链路

- `CanvasNode`
- `CanvasEdge`
- `src/components/canvas/infinite-canvas`
- `src/stores/canvas-store.ts`
- `src/app/api/canvas/[conversationId]/route.ts`
- `src/app/api/canvas/[conversationId]/actions/route.ts`

现状：

- 已经支持一个 conversation 绑定一套 canvas 节点和连线。
- 当前画板已经能承载图片、文本、PDF、图表等内容。

### 已有项目和团队基础

- `InvestmentProject`
- `InvestmentProjectMember`
- `WorkflowDraft`
- `WorkflowNode`

现状：

- 项目和成员关系表已经存在。
- `WorkflowDraft` 已经有 `investmentProjectId`，可继续复用为 skill session 的运行态草稿。

## 目标

新的方案需要满足以下目标：

1. 项目是协作容器，不是预生成的大 workflow。
2. 第一个发起项目对话的人是项目负责人。
3. 项目负责人可以邀请其他员工加入团队。
4. 项目成员进入项目后，可以直接和 AI 对话，不必先调用 skill。
5. 员工调用 skill 时，才创建一个独立的 `skill session / workflow session`。
6. session 内的 workflow 只影响这次运行，不直接改原始 skill。
7. 用户点击“更新为当前流程”时，只更新该员工自己的 skill 定义。
8. 每次 skill 运行后，必须生成一个主产物卡回贴到项目看板。
9. 后续成员可以手动选择已有产物作为输入，也允许完全不选输入直接运行。

## 核心概念

### 1. Project

项目是协作容器，承载：

- 项目主题
- 项目负责人
- 团队成员
- 项目级对话
- 项目级看板
- 项目级产物
- 最近的 skill sessions

项目本身不再自动生成 workflow。

### 2. Project Conversation

每个项目有且仅有一个主对话线程。

关键规则：

- 第一个发起对话的人就是项目负责人。
- 项目创建时自动创建一个 `Conversation` 并绑定到该项目。
- 项目负责人和项目成员都可以进入这个项目对话。
- 项目中的日常讨论不要求调用 skill。
- 对话消息可以直接推动项目分析、任务分配、讨论决策和产物沉淀。

这意味着项目里存在两种协作路径：

1. 直接对话型协作
2. skill 驱动型协作

二者都合法，不能把项目体验强行收敛到 skill 上。

### 3. Skill Definition

`SkillDefinition` / `SkillSop` 继续作为员工个人资产，用于：

- 描述员工自己的可复用 skill
- 提供 SOP / 节点蓝图
- 作为 skill session 的来源模板

### 4. Skill Session / Workflow Session

当某员工在项目中主动选择一个 skill 时，系统创建一条独立 session。

这条 session 表示：

> 某员工在某项目里，基于自己的某个 skill / SOP，发起了一次独立执行。

session 至少应包含：

- `projectId`
- `employeeProfileId`
- `skillDefinitionId`
- `skillSopId`
- `inputArtifactIds[]`
- `workflow draft`
- `status`
- `finalArtifactId`

UI 上，session 应表现为一个独立的 workflow 编辑面板，而不是项目主界面本身。

### 5. Artifact

Artifact 是项目协作的核心对象。

每次 skill 运行后必须落一个主产物卡。类型限定为：

- `markdown`
- `text`
- `image`
- `summary_table`

每个主产物卡至少要记录：

- 来源项目
- 来源员工
- 来源 skill / SOP
- 来源 session
- 输入产物引用
- 创建时间

## 交互模型

### A. 创建项目

项目创建时只做以下事情：

- 创建 `InvestmentProject`
- 记录 initiator
- 建立 initiator 的成员记录
- 选择其他成员并建立 `InvestmentProjectMember`
- 创建项目主 `Conversation`
- 初始化空看板和空产物列表

注意：

- 第一个发起对话的人就是项目负责人。
- 项目创建时不自动生成 workflow。

### B. 项目内直接对话

员工进入项目后，可以直接和 AI 对话。

这条链路用于：

- 讨论项目方向
- 追问分析结论
- 协调成员分工
- 基于当前上下文继续推进任务
- 让 AI 直接产出文字建议

注意：

- 这类对话不要求绑定 skill。
- AI 回复可以不产生 workflow。
- AI 回复可以选择性沉淀到看板，但不强制。

### C. 在项目中发起 skill

员工在项目中也可以发起 skill：

1. 选择自己的某个 skill
2. 可选选择某个 SOP
3. 手动勾选已有 artifacts 作为输入
4. 也允许不选任何输入
5. 创建一条新的 skill session

此时系统才从员工 skill 定义复制一份运行态 workflow draft。

### D. 编辑 skill session workflow

进入 session 后：

- 用户可以查看该次 workflow
- 可以增删改节点
- 可以调整依赖
- 可以改节点标题、参数和 SOP 绑定

这些编辑只影响当前 session，不影响员工原始 skill 定义。

### E. 执行 skill session

执行时：

- 后端把输入 artifacts 整理成结构化上下文
- 把 session workflow、输入产物、项目主题、员工画像一起传给执行链路
- 最终必须生成一个主产物卡
- 主产物卡回贴到项目看板

### F. 更新当前流程

如果用户在 session 中点击“更新为当前流程”：

- 把本次 session 的 workflow 结构回写到该员工自己的 skill 定义
- 不影响其他员工
- 不自动改历史 session
- 不自动修改项目级配置

## UI 结构

项目页主视图应调整为三块：

### 1. 项目对话区

负责：

- 项目讨论
- 与 AI 的直接对话
- 发起 skill 的入口
- 展示最近活动摘要

### 2. 团队成员区

展示：

- 成员画像
- 职位 / 部门 / focus areas
- 已封装 skills
- 项目负责人邀请成员的入口

### 3. 项目看板区

展示：

- 项目主对话绑定的 canvas
- 已沉淀的 artifacts
- 产物类型
- 来源员工
- 来源 skill
- 上游输入引用

项目主界面默认不展开 workflow，仅在打开 skill session 时展示 session workflow 面板。

## 数据模型建议

### 复用现有模型

- `InvestmentProject` 继续作为项目主体
- `InvestmentProjectMember` 继续作为团队成员表
- `WorkflowDraft` 改语义为 skill session 的运行态草稿
- `WorkflowNode` 继续作为 session 节点

### 建议新增或调整

#### 1. 给项目绑定主对话

建议给 `Conversation` 增加：

- `investmentProjectId`

用途：

- 一个项目绑定一个主对话
- 当前聊天和画板链路继续复用 `conversationId`

同时需要把现有 conversation 权限从“只能 owner 访问”调整成：

- 普通 conversation：仍按 `userId`
- 项目 conversation：按 `InvestmentProjectMember` 判权

#### 2. 新增 ProjectArtifact

建议新增 `ProjectArtifact`：

- `investmentProjectId`
- `employeeProfileId`
- `workflowDraftId`
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

#### 3. 给 WorkflowDraft 增加 session 语义字段

建议给 `WorkflowDraft` 增加：

- `sessionType`
- `skillDefinitionId`
- `skillSopId`
- `sourceConversationId`
- `finalArtifactId`

这样 `WorkflowDraft` 可以明确表示“某项目中的某次 skill session”。

## API 设计

### 项目接口

#### `POST /api/employee-investment/projects`

输入：

- `title`
- `topic`
- `memberEmployeeCodes[]`
- 可选 `objective`
- 可选 `priority`

输出：

- 项目基础信息
- initiator
- members
- 主 conversation
- 空 artifact 列表
- 最近 sessions 摘要

#### `GET /api/employee-investment/projects/:id`

返回：

- 项目详情
- initiator
- members
- conversation
- artifacts
- recent skill sessions

### Skill Session 接口

#### `POST /api/employee-investment/projects/:id/skill-sessions`

输入：

- `employeeId`
- `skillDefinitionId`
- `skillSopId?`
- `inputArtifactIds[]`

输出：

- 新建 session
- workflow draft nodes

#### `GET /api/employee-investment/skill-sessions/:id`

返回：

- session 基本信息
- workflow draft
- 发起员工
- 绑定 skill / SOP
- 输入 artifact 摘要

#### `PATCH /api/employee-investment/skill-sessions/:id/nodes/...`

用于：

- 编辑节点
- 更新依赖
- 增删节点

#### `POST /api/employee-investment/skill-sessions/:id/execute`

效果：

- 运行该 session
- 生成主产物卡
- 将产物回贴到项目看板

#### `POST /api/employee-investment/skill-sessions/:id/save-as-current-skill-flow`

效果：

- 用本次 session 的 workflow 更新该员工自己的 skill 定义

## SQL 对应物

这份方案对应的 SQL 草案已单独保存到：

- `prisma/proposals/2026-04-06_project_first_collaboration_design.sql`

注意：

- 这是审核用 SQL 草案
- 不是正式 Prisma migration
- 审核通过后，再拆成正式 migration 执行

## 验收标准

1. 创建项目时，不自动生成 workflow。
2. 第一个发起项目对话的人，被记录为项目负责人。
3. 项目负责人可以把其他员工拉入项目成员表。
4. 项目成员可以直接进入项目对话并和 AI 交互，不必先调用 skill。
5. 项目成员可以在项目内发起 skill session。
6. session 节点编辑只影响当前 session，不影响员工原始 skill。
7. 点击“更新为当前流程”后，只更新该员工 skill。
8. skill 执行后必须生成主产物卡并回贴到项目看板。
9. 后续 skill 可以选择 0 个、1 个、多个 artifacts 作为输入。
10. 项目对话、成员列表、看板展示在没有 skill 执行时也必须正常工作。
