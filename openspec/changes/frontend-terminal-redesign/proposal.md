## Why

当前前端虽然有 macOS 窗口风格基底，但视觉表现力不足——终端/黑客美学仅停留在 `font-mono` 标签层面，缺乏系统级的 ASCII art 装饰、打字机动效、扫描线质感和 CRT 光晕效果。重构将在保留 macOS 窗口 chrome 的基础上，注入强烈的**终端 + 字符画**视觉风格，配合精心编排的动效系统，打造一个在投资分析领域独树一帜的 cyberpunk-meets-clinical 界面。

## What Changes

- **全局视觉系统重构**：新增 CRT 扫描线叠加层、终端光晕（text-shadow glow）、绿屏/琥珀色配色方案，在 macOS 窗口框架内呈现终端质感
- **ASCII Art 装饰系统**：使用字符画作为品牌 logo、页面分隔符、加载动画、空状态插画和数据可视化辅助元素
- **打字机动效引擎**：聊天消息逐字输出（typewriter effect）、命令行风格的 prompt 光标闪烁、Phase 切换时的 boot sequence 动画
- **终端风格组件重写**：将 `ChatView`、`ChatMessage`、`ChatInput`、`WelcomeDashboard`、`IconRail`、`StatusBar` 等核心组件改造为终端外观（等宽字体、绿色前景、`>_` prompt 符号、行号装饰）
- **页面过渡动效**：路由切换时的 glitch/静态噪点过渡、面板展开的 fold-in 动画、画布节点出现时的 materialize 效果
- **Landing Page 重做**：纯 ASCII art 欢迎界面 + 终端启动序列动画，保留 macOS 窗口框架
- **清理遗留代码**：移除未使用的 `Sidebar`、`Header`、`ViewportPanel`；统一 `pa-*` token 到 `@theme`

## Capabilities

### New Capabilities
- `terminal-design-system`: 终端视觉系统——CRT 效果层、扫描线、光晕、终端配色 token、等宽排版规范
- `ascii-art-components`: ASCII 字符画组件库——Logo、分隔线、加载动画、空状态、数据装饰
- `motion-system`: 动效编排系统——打字机效果、glitch 过渡、boot sequence、materialize、光标动画
- `terminal-chat-ui`: 终端风格聊天界面——命令行式输入、Phase 可视化、工具调用终端化展示

### Modified Capabilities

## Impact

- **受影响组件**：`chat-view.tsx`、`chat-message.tsx`、`chat-input.tsx`、`welcome-dashboard.tsx`、`icon-rail.tsx`、`status-bar-client.tsx`、`mac-window.tsx`、`agent-block.tsx`、`phase-block.tsx`、`tool-event-badge.tsx`、`landing page`
- **样式**：`globals.css` 新增终端 token 和动效 keyframes；可能新增独立动效 CSS 模块
- **依赖**：可能引入 `framer-motion` 用于编排复杂动效序列
- **不受影响**：后端 API、Python Agent、数据库、Canvas 核心逻辑（仅节点外观微调）、认证流程
