## ADDED Requirements

### Requirement: Terminal prompt input
聊天输入框 MUST 改造为终端命令行风格：左侧显示固定的 prompt 前缀 `user@pha:~$`（使用 `--term-green-dim` 颜色），输入区域使用等宽字体，背景为 `--term-bg-surface`。按 Enter 发送，Shift+Enter 换行。末尾 MUST 显示闪烁方块光标。

#### Scenario: 空输入状态
- **WHEN** 输入框无内容
- **THEN** 显示 `user@pha:~$ ` prompt 前缀和闪烁光标，placeholder 为暗绿色 `Type a command...`

#### Scenario: 输入内容
- **WHEN** 用户输入文字
- **THEN** 文字以终端绿色等宽字体显示在 prompt 后方

#### Scenario: 发送消息
- **WHEN** 用户按 Enter
- **THEN** 消息发送，输入框清空，prompt 重新出现

### Requirement: Terminal message rendering
用户消息 MUST 渲染为终端命令回显格式：以 `$ ` 前缀 + 用户文本显示。助手消息 MUST 以无前缀纯输出格式显示，颜色为 `--term-green`。

#### Scenario: 用户消息显示
- **WHEN** 消息列表渲染用户消息
- **THEN** 消息以 `$ 用户原文` 格式显示，等宽字体，前缀为暗绿色

#### Scenario: 助手消息显示
- **WHEN** 消息列表渲染助手消息
- **THEN** 消息以终端输出格式显示，支持 Markdown 渲染，整体配色为终端绿

### Requirement: Phase block terminal display
PEC Agent 的 Phase 块 MUST 以终端日志流格式展示：Phase 标题为高亮行（如 `[12:30:45] ═══ PLAN ═══`），内容缩进 2 空格，工具调用以 `> tool_name(args)` 格式显示，结果以 `← result_summary` 格式显示。

#### Scenario: Plan phase 显示
- **WHEN** Plan phase 完成并展示
- **THEN** 显示时间戳 + Phase 标题 + Plan 的 reasoning 和 steps（以编号列表形式）

#### Scenario: Execute phase 工具调用
- **WHEN** Execute phase 调用工具 `get_stock_quote`
- **THEN** 实时显示 `> get_stock_quote("000538")` 和返回结果 `← { price: 62.5, ... }` 的缩略

#### Scenario: Check phase 显示
- **WHEN** Check phase 完成
- **THEN** 显示 `[PASS]` 或 `[FAIL]` 状态标签 + 检查摘要

### Requirement: Tool event terminal display
工具调用事件 MUST 以终端命令执行格式展示：调用时显示 `> tool_name(args...)`，等待时显示 ASCII spinner，完成时显示 `← result`（成功绿色/失败红色）。可展开查看完整参数和结果。

#### Scenario: 工具调用中
- **WHEN** 工具正在执行
- **THEN** 显示 `> memory_recall("云南白药") ` 后跟 ASCII 旋转加载

#### Scenario: 工具成功
- **WHEN** 工具调用成功
- **THEN** 加载消失，显示绿色 `← [OK] 3 results`，可点击展开完整结果

#### Scenario: 工具失败
- **WHEN** 工具调用失败
- **THEN** 显示红色 `← [ERR] timeout after 30s`

### Requirement: Welcome dashboard terminal style
欢迎界面 MUST 替换为终端风格：ASCII art 欢迎图 + Boot sequence 动画 + 示例命令以 `$` 前缀展示（可点击自动填入输入框）。

#### Scenario: 首次进入
- **WHEN** 用户进入空聊天页面
- **THEN** 显示 ASCII art 欢迎图 → Boot sequence 动画 → 3-4 个可点击的示例命令（如 `$ 分析恒瑞医药的投资价值`）

#### Scenario: 点击示例命令
- **WHEN** 用户点击示例命令
- **THEN** 命令文本自动填入输入框并聚焦

### Requirement: Icon rail terminal style
`IconRail` MUST 更新为终端风格：背景为 `--term-bg-raised`，图标使用 `--term-green-dim`，hover 时切换为 `--term-green` + 辉光效果，当前页面的图标持续高亮。底部显示简化的 ASCII 用户标识。

#### Scenario: 导航 hover
- **WHEN** 鼠标悬停在导航图标上
- **THEN** 图标从暗绿变为亮绿并带辉光，旁边出现终端风格 tooltip（深色背景、绿色边框、等宽字体）

### Requirement: Status bar terminal style
`StatusBar` MUST 更新为终端状态行风格：左侧显示 `PharmaAlpha v1.0`（终端绿），中间显示系统状态 `[SYS OK]`（绿色）或 `[SYS ERR]`（红色闪烁），右侧显示时间戳（持续更新，`HH:MM:SS` 格式）和用户标识。整体为单行固定高度。

#### Scenario: 正常状态
- **WHEN** 系统正常运行
- **THEN** 状态栏显示 `PharmaAlpha v1.0 │ [SYS OK] │ 14:30:25 │ user@pha`

### Requirement: Landing page terminal redesign
落地页 MUST 重做为终端启动界面风格：大幅 ASCII art 品牌图 + 终端风格的功能介绍（逐行打字机显示）+ macOS 窗口框架 + `[Login]` / `[Register]` 终端风格按钮。

#### Scenario: 页面加载
- **WHEN** 用户访问 `/`
- **THEN** macOS 窗口框架内播放终端启动动画 → 显示 ASCII art logo → 逐行打字显示功能介绍 → 底部出现操作按钮
