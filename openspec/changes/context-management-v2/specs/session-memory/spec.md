## ADDED Requirements

### Requirement: SessionMemory 数据模型
系统 SHALL 新增 Prisma 模型 `SessionMemory`，字段如下：
- `id`: String @id @default(cuid())
- `userId`: String
- `category`: String（枚举值：`"entity"` | `"conclusion"`）
- `key`: String（实体名称或结论标题）
- `value`: String @db.Text（实体详情或结论内容）
- `updatedAt`: DateTime @updatedAt
- `createdAt`: DateTime @default(now())

`userId + category + key` 组合唯一（@@unique），支持 upsert。每个用户最多存储 50 条记忆（写入时如超过上限则删除最早的记录）。

#### Scenario: 写入实体记忆
- **WHEN** 用户分析过"恒瑞医药（600276）"后 Agent 完成 Synthesize
- **THEN** 系统 upsert SessionMemory: `{ userId, category: "entity", key: "恒瑞医药", value: "600276, 医药制造, 上次分析时间..." }`

#### Scenario: 记忆上限清理
- **WHEN** 某用户已有 50 条记忆，新写入第 51 条
- **THEN** 删除该用户 `createdAt` 最早的一条记忆后再写入

### Requirement: 新会话记忆注入
route.ts 在加载对话历史后、传给 Agent 前 SHALL 查询当前用户的 SessionMemory 记录（最近 20 条），格式化为环境上下文消息注入到 messages 数组头部。

#### Scenario: 有记忆的新会话
- **WHEN** 用户有 5 条 entity 记忆和 3 条 conclusion 记忆
- **THEN** Agent 收到的 messages 头部包含一条 system 消息："用户关注: 恒瑞医药(600276), 以岭药业(002603)... 历史结论: ..."

#### Scenario: 无记忆的新用户
- **WHEN** 用户没有任何 SessionMemory 记录
- **THEN** 不注入记忆相关的 system 消息

### Requirement: Agent 输出中提取记忆
route.ts 的 `captureAndForward` flush 阶段 SHALL 解析 Agent 输出内容，提取关键实体（股票代码+名称）和核心结论（不超过 200 字），写入 SessionMemory。

提取策略：
- entity: 从文本中匹配 `(\d{6})` 股票代码模式 + 相邻的中文公司名
- conclusion: 取 Agent 输出的最后一个"综合评估"或"投资建议"段落的前 200 字

#### Scenario: 提取股票实体
- **WHEN** Agent 输出包含 "恒瑞医药（600276）当前价格 45.20 元"
- **THEN** 提取 entity: key="恒瑞医药", value="600276, 价格45.20元, 分析时间..."

#### Scenario: 无可提取内容
- **WHEN** Agent 输出为闲聊回复，不包含股票代码
- **THEN** 不写入任何 SessionMemory
