## ADDED Requirements

### Requirement: Typewriter text effect
系统 SHALL 提供 `TypewriterText` 组件/hook，以逐字符方式渲染文本，模拟终端输出效果。MUST 支持可配置的字符间隔（默认 30ms）、光标显示、SSE 流式数据源兼容。在流式接收 chunk 时，新内容 SHALL 以打字机速度追加。

#### Scenario: Agent 回复流式输出
- **WHEN** SSE 流推送 `chunk` 事件
- **THEN** 文字以逐字符动画方式出现，末尾显示闪烁方块光标

#### Scenario: 流速快于打字速度
- **WHEN** SSE 流推送速度超过打字机间隔
- **THEN** 缓冲区即时追赶，不丢失内容，保持视觉流畅

### Requirement: Cursor blink animation
系统 SHALL 提供全局可复用的闪烁方块光标（`█`），通过 CSS `@keyframes` 实现 530ms 周期闪烁。MUST 以 `.cursor-blink` 类暴露，颜色跟随 `--term-green`。

#### Scenario: 输入框光标
- **WHEN** 聊天输入框获得焦点
- **THEN** 输入框末尾显示闪烁的绿色方块光标

#### Scenario: 打字结束
- **WHEN** Agent 回复完成（流结束）
- **THEN** 光标消失（或停止闪烁）

### Requirement: Boot sequence animation
系统 SHALL 提供 `BootSequence` 组件，在特定场景下播放终端启动序列动画：逐行显示系统信息（版本号、加载模块、连接状态）+ 进度反馈 + 最终 `READY` 状态。MUST 支持自定义行内容和时序。

#### Scenario: 新对话启动
- **WHEN** 用户创建新对话且聊天区域为空
- **THEN** 播放 2-3 秒的 boot sequence 动画（如 `> Initializing PEC Agent...`、`> Loading memory modules...`、`> System READY`），然后过渡到欢迎界面

#### Scenario: 跳过
- **WHEN** 用户在 boot sequence 播放期间输入消息
- **THEN** 动画立即跳过，进入正常交互状态

### Requirement: Phase transition animation
系统 SHALL 在 PEC Agent 的 Phase 切换时播放过渡动画。进入新 Phase 时 MUST 展示一个简短的标题行动画（如 `══════ PLAN ══════` 从左到右展开），持续 300-500ms。

#### Scenario: Plan → Execute 切换
- **WHEN** Agent 从 Plan 阶段进入 Execute 阶段
- **THEN** Execute 区域以 `═══ EXECUTE ═══` 样式的标题行动画入场，旧 Phase 内容保持可见

### Requirement: Glitch transition effect
系统 SHALL 提供 `GlitchTransition` 组件，在路由切换或面板打开/关闭时播放短暂的 glitch（故障）效果：随机色块位移 + 文字错位 + 噪点闪烁，持续 150-300ms。MUST 不影响内容的最终可读性。

#### Scenario: 路由切换
- **WHEN** 用户从 `/chat` 导航到 `/agents`
- **THEN** 页面内容区播放短暂 glitch 过渡效果后显示新页面

### Requirement: List stagger entrance
系统 SHALL 对列表型内容（对话历史、Agent 列表、工具事件列表）应用交错入场动画：各项按顺序依次淡入 + 从左微移入场，间隔 50ms。MUST 使用 `framer-motion` 的 `stagger` 实现。

#### Scenario: 对话列表加载
- **WHEN** 侧边栏加载对话历史列表
- **THEN** 各对话项以 50ms 间隔依次从左滑入

### Requirement: Canvas node materialize
系统 SHALL 在画布节点出现时播放 "materialize" 效果：节点从低透明度 + 微弱缩放 + 底部绿色光晕 逐步显现为完整节点，持续 400ms。

#### Scenario: Agent 添加图表节点
- **WHEN** Agent 通过 `canvas_add_chart` 在画布上添加新节点
- **THEN** 节点以 materialize 动效从虚无中显现
