## 1. 基础设施 — 终端设计系统

- [x] 1.1 在 `globals.css` 的 `@theme inline` 中添加所有 `--term-*` 颜色 token（green、green-dim、amber、cyan、red、bg、bg-raised、bg-surface、glow）
- [x] 1.2 更新 `:root` 下 shadcn token（`--background`、`--foreground`、`--primary`、`--card` 等）为暗色终端值
- [x] 1.3 将 body 基础样式切换为 `--term-bg` 背景 + `--term-green` 前景 + `font-mono` 主字体
- [x] 1.4 实现 CRT 扫描线叠加层（`.crt-active body::after` repeating-linear-gradient 1px 条纹 + pointer-events:none）
- [x] 1.5 实现终端文字辉光系统（`.glow-none`、`.glow-subtle`、`.glow-normal`、`.glow-strong` 四级 text-shadow）
- [x] 1.6 更新滚动条样式为 `--term-green-dim` 终端风格
- [x] 1.7 更新 `.glass`、`.glass-subtle`、`.glass-strong` 为暗色终端玻璃质感
- [x] 1.8 更新 `.prose-pa` Markdown 渲染样式适配暗色终端配色 + hljs 代码高亮改为终端色
- [ ] 1.9 安装 `framer-motion` 依赖

## 2. 清理遗留代码

- [x] 2.1 删除 `src/components/layout/sidebar.tsx` 及所有引用
- [x] 2.2 删除 `src/components/layout/header.tsx` 及所有引用
- [x] 2.3 删除 `src/components/chat/viewport-panel.tsx` 及 `src/stores/viewport-store.ts` 及所有引用
- [x] 2.4 清理 `globals.css` 中 `pa-*` 未定义 token 引用（`investment-team/page.tsx` 中使用的 `text-pa-green` 等改为 `--term-*`）

## 3. ASCII Art 组件库

- [x] 3.1 创建 `src/components/terminal/ascii-logo.tsx`（`<pre>` 渲染，支持 sm/md/lg size prop，带辉光）
- [x] 3.2 创建 `src/components/terminal/ascii-divider.tsx`（多种 variant 字符线型分隔符）
- [x] 3.3 创建 `src/components/terminal/ascii-spinner.tsx`（旋转符号 + 进度条 + 矩阵雨三种风格，80-120ms 帧率）
- [x] 3.4 创建 `src/components/terminal/ascii-empty-state.tsx`（字符画插图 + 说明文字）
- [x] 3.5 创建 `src/components/terminal/ascii-status-badge.tsx`（`[OK]` / `[FAIL]` / `[WAIT]` 彩色状态标签）

## 4. 动效系统

- [x] 4.1 实现 `.cursor-blink` CSS 动画（530ms 周期闪烁方块光标）
- [x] 4.2 创建 `src/hooks/use-typewriter.ts` hook（逐字输出 + 流式兼容 + 缓冲追赶逻辑）
- [x] 4.3 创建 `src/components/terminal/boot-sequence.tsx`（逐行打字显示系统启动信息 + READY 状态 + 可跳过）
- [x] 4.4 创建 `src/components/terminal/phase-transition.tsx`（Phase 标题行展开动画，CSS clip-path）
- [x] 4.5 创建 `src/components/terminal/glitch-transition.tsx`（路由切换 glitch 效果，150-300ms）
- [ ] 4.6 实现列表 stagger 入场动画工具函数（framer-motion variants + stagger 50ms）
- [ ] 4.7 实现画布节点 materialize 效果（opacity + scale + glow 渐现，400ms）

## 5. 核心组件终端化改造

- [x] 5.1 改造 `MacWindow`：添加 dark terminal variant（深色玻璃背景、交通灯保留、标题 `--term-green-dim`）
- [x] 5.2 改造 `IconRail`：`--term-bg-raised` 背景、图标 `--term-green-dim` + hover 辉光、终端风格 tooltip
- [x] 5.3 改造 `StatusBar`：终端状态行风格（`PharmaAlpha v1.0 │ [SYS OK] │ HH:MM:SS │ user@pha`，实时时钟）
- [x] 5.4 改造 `ChatInput`：终端 prompt 前缀 `user@pha:~$` + 等宽字体 + 方块光标 + Enter 发送
- [x] 5.5 改造 `ChatMessage`：用户消息 `$ 前缀`、助手消息终端输出格式、整体等宽字体
- [x] 5.6 改造 `PhaseBlock`：终端日志流格式（时间戳 + Phase 标题 + 缩进内容），集成 phase-transition 动画
- [x] 5.7 改造 `ToolEventBadge`：`> tool_name(args)` 格式 + ASCII spinner 等待 + `← [OK]/[ERR] result` 结果
- [x] 5.8 改造 `AgentBlock` / `SupervisorBlock`：适配终端配色和布局

## 6. 页面级改造

- [x] 6.1 重做 `WelcomeDashboard`：ASCII art 欢迎图 + BootSequence 动画 + 可点击示例命令
- [x] 6.2 重做 Landing Page（`src/app/page.tsx`）：macOS 窗口 + ASCII logo + 打字机功能介绍 + 终端按钮
- [x] 6.3 更新 Login/Register 页面配色和布局适配终端暗色风格
- [x] 6.4 更新 Agents 页面（`/agents`）：卡片改为终端面板样式 + stagger 入场
- [x] 6.5 更新 Settings 页面：终端表单风格
- [x] 6.6 更新 `InfiniteCanvas` / `CanvasCardNode`：暗色节点卡片 + materialize 入场动画
- [x] 6.7 更新 `investment-team` 页面配色适配 `--term-*` token（替换 `pa-*` 引用）

## 7. 集成与打磨

- [x] 7.1 在 Dashboard layout 中添加 `.crt-active` 类到 body + Settings 中添加 CRT 效果开关
- [ ] 7.2 在 Dashboard layout 中集成 `GlitchTransition` 路由过渡
- [ ] 7.3 验证 `useChatStream` + `useTypewriter` 的 SSE 流式兼容性
- [ ] 7.4 验证所有 shadcn 组件（Button、Select、Dialog、Sheet 等）在暗色终端 token 下正常渲染
- [ ] 7.5 响应式检查：确保终端布局在 768px-1920px 宽度范围正常
- [ ] 7.6 性能检查：CRT 效果对帧率影响 < 5%，framer-motion 动画流畅
