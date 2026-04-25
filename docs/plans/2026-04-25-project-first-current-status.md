# Project-first 当前实现状态

更新时间：2026-04-25

## 结论

当前 `investment-team` 的新主链路已经从“前端写死展示”迁移为“数据库 + API + 项目工作台”驱动。

核心流程已经具备基本跑通能力：

1. 创建或查看真实 `InvestmentProject`。
2. 项目自动拥有主会话 `Conversation(conversationType = project_main)`。
3. 项目会话复用现有聊天和画布能力。
4. 项目成员记录在 `InvestmentProjectMember`，当前展示阶段默认不强制成员授权。
5. 聊天回复和画布节点可以沉淀为 `ProjectArtifact`。
6. `ProjectArtifact` 可以查看、编辑、删除、加入画布。
7. 项目内可以基于员工 `SkillDefinition` / `SkillSop` 创建 skill session。
8. session 执行会创建 `WorkflowExecution`，并自动产出新的 `ProjectArtifact`。
9. 后续 session 可以选择已有 artifacts 作为输入。

因此，现在不是纯前端静态 demo。前端仍有 demo 数据入口和部分展示文案，但核心对象已经来自数据库和 API。

## 当前入口

新入口：

- `/investment-team/projects`

旧入口：

- `/investment-team`

导航中的 Investment 已指向新入口，旧入口作为 `Legacy Workflow` 保留。

## 访问策略

当前为了比赛展示和快速验证，项目访问默认开放给已登录用户。

- 默认：`EMPLOYEE_PROJECT_ACCESS_OPEN` 未设置或不是 `false`，已登录用户可查看项目。
- 严格模式：设置 `EMPLOYEE_PROJECT_ACCESS_OPEN=false` 后，项目访问需要 `InvestmentProjectMember(status = active)`。

这不是没有权限模型，而是展示期默认放宽。成员关系仍然会落库，用于项目语义、上下文注入和后续严格授权。

## Artifact 语义

`ProjectArtifact` 不是流程本身，而是项目沉淀物，也就是项目资产。

典型来源：

- 手动新增的 markdown 分析材料。
- 聊天助手回复点击 `Save Artifact` 后保存。
- 画布节点点击保存后保存。
- skill session 执行完成后自动保存。

典型用途：

- 作为项目资料长期留存。
- 加回画布展示。
- 作为后续 skill session 输入。
- 作为项目聊天上下文的一部分注入给投资团队 agent。

## 现在仍然是 demo 的部分

这些部分不是阻塞主链路，但还不是完整生产能力：

- demo 员工仍通过 `employeeCode` 前缀 `demo-` 过滤。
- 风险推演还没有完整独立后端链路，目前主要依赖 skill/session/artifact 链路承载。
- 通知和反馈闭环尚未正式落地。
- artifact 还没有版本树和复杂血缘关系表，当前 `inputArtifactIds` 先用 Json。
- project canvas 仍复用主会话的 `CanvasNode` / `CanvasEdge`，没有单独拆 `ProjectCanvas`。

## 演示数据

新增 SQL：

- `prisma/seeds/project_first_demo.sql`

执行方式：

```bash
psql "$DATABASE_URL" -f prisma/seeds/project_first_demo.sql
```

Windows PowerShell 示例：

```powershell
psql $env:DATABASE_URL -f prisma/seeds/project_first_demo.sql
```

执行后前端可看到：

- `恒瑞医药创新管线投资评估`
- `CXO 政策与订单景气度跟踪`
- demo 成员
- demo artifacts
- demo sessions
- demo canvas nodes

如果你用自己的登录账号，先登录一次让系统自动创建 `EmployeeProfile`，再执行该 SQL；SQL 会给所有已存在员工补一个默认 `项目综合分析` skill，保证新项目页的 skill session 下拉框有可选项。

## 下一步建议

优先级最高的后续完善：

1. session 执行状态展示：执行中、失败、重新执行、失败原因。
2. artifact 血缘展示：输入资产、输出资产、来源 session、来源 execution。
3. 风险推演第一条真实链路：政策影响场景输入 -> agent 结构化输出 -> `risk_snapshot` artifact。
4. 站内通知闭环：将关键 artifact 推送给项目成员并记录反馈。

## 团队协作语义调整建议

当前项目页已经有成员、技能、session、artifact 的真实数据链路，但“团队协作”的产品表达还不够明显。用户看到 `Skill Session` 下拉框时，容易理解成“选择一个技术流程”，而不是“组织一个投资研究团队完成任务”。

更合理的产品语义应该从 `Skill Session` 升级为 `Team Task / 协作任务`：

1. 先选择负责人或参与成员。
2. 再选择该成员的技能和 SOP。
3. 再选择输入 artifacts。
4. 创建一张任务卡。
5. 执行任务。
6. 输出 artifact。
7. 由项目成员 review、评论或确认。

这样用户理解的是：

- 不是在选择抽象技能，而是在指派某个团队成员处理一个研究问题。
- skill 是成员能力。
- SOP 是该成员处理问题的方法。
- session 是一次具体协作任务。
- artifact 是这次任务沉淀出的项目资产。

推荐的 UI 调整：

- 将 `Skill Session` 区块改名为 `Team Tasks` 或 `协作任务`。
- 任务创建表单从“选 skill”改为“选负责人 -> 选能力 -> 选输入材料”。
- 项目成员卡片展示 title、department、focus areas、skills。
- session 列表展示 `负责人 / 技能 / 输入数 / 状态 / 输出数`。
- session 详情展示输入 artifacts、执行 prompt、输出 artifact、失败原因。
- artifact 增加 review 状态：draft、reviewing、approved、needs_changes。

这能更直接体现团队协作，而不是仅展示多个成员名字。

## Skill Demo 执行策略

当前 session execute 接口会构造一个明确的执行提示词，包含：

- 项目标题和主题。
- 当前任务 topic。
- 选中的 skill 和 SOP。
- 输入 artifacts 的标题和正文摘要。
- 要求输出 markdown memo：结论、证据、风险、不确定性、下一步动作。

如果 Python agent runtime 正常可用，接口会调用 `employee_investment_team` 的 `execute_workflow`。

如果 agent runtime 不可用或返回错误，接口不会让 demo 链路中断，而是生成一个 fallback markdown artifact。fallback 会保存：

- 任务结论占位。
- 输入 artifacts 证据摘要。
- 推荐下一步动作。
- 本次执行使用的 prompt。
- agent 失败原因。

这个 fallback 不是最终智能分析能力，但它保证 project -> task/session -> execution -> artifact 的真实数据闭环可以演示和验证。
