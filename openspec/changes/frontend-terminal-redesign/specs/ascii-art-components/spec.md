## ADDED Requirements

### Requirement: ASCII logo component
系统 SHALL 提供一个 `AsciiLogo` 组件，以预渲染的字符画形式展示 PharmaAlpha 品牌标识。MUST 使用 `<pre>` + 等宽字体渲染，支持 `size` prop（`sm` / `md` / `lg`）控制字号。字符画 MUST 使用 `--term-green` 颜色并带辉光效果。

#### Scenario: Landing page logo
- **WHEN** 用户访问落地页
- **THEN** 页面顶部展示 ASCII 字符画形式的 PharmaAlpha logo，`size="lg"`，带磷光绿辉光

#### Scenario: Sidebar logo
- **WHEN** `IconRail` 顶部渲染 logo
- **THEN** 展示简化版 ASCII logo（`size="sm"`），宽度适配 64px 导航栏

### Requirement: ASCII divider component
系统 SHALL 提供 `AsciiDivider` 组件，用字符画线条（如 `═══════════`、`─── ◆ ───`、`>> ──────── <<`）作为内容分隔符，替代纯 CSS `<hr>`。MUST 支持 `variant` prop 选择不同线型。

#### Scenario: Phase 之间分隔
- **WHEN** 聊天消息中 PEC 的不同 Phase 之间需要视觉分隔
- **THEN** 使用 `AsciiDivider` 渲染字符画分隔线

### Requirement: ASCII loading spinner
系统 SHALL 提供 `AsciiSpinner` 组件，以字符帧动画形式展示加载状态。MUST 支持至少 3 种风格：旋转符号（`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`）、进度条（`[████░░░░░░]`）、矩阵雨（竖向字符流）。动画频率 MUST 为 80-120ms 每帧。

#### Scenario: 等待 Agent 响应
- **WHEN** 消息发送后等待 Agent 首次响应
- **THEN** 在消息区域展示 ASCII 旋转加载动画

#### Scenario: 长时间等待
- **WHEN** 等待超过 3 秒
- **THEN** 加载动画切换为带进度提示文字的变体（如 `[████░░░░░░] Connecting...`）

### Requirement: ASCII empty state
系统 SHALL 提供 `AsciiEmptyState` 组件，用字符画插图（如计算机、图表、文件夹等轮廓）作为空状态的视觉元素，替代传统图标/插画。MUST 搭配简短的说明文字。

#### Scenario: 无对话历史
- **WHEN** 用户首次打开聊天页面且无历史
- **THEN** 展示 ASCII 字符画风格的欢迎界面（替代现有 `WelcomeDashboard`）

### Requirement: ASCII status badges
系统 SHALL 提供 `AsciiStatusBadge` 组件，以字符画形式展示状态标签（如 `[ OK ]`、`[FAIL]`、`[WAIT]`、`[ ▶ ]`）。MUST 使用与状态语义匹配的终端颜色（green=成功、red=失败、amber=等待、cyan=进行中）。

#### Scenario: 工具调用状态
- **WHEN** `ToolEventBadge` 展示工具调用结果
- **THEN** 使用 ASCII 状态标签样式，成功显示绿色 `[ OK ]`，失败显示红色 `[FAIL]`
