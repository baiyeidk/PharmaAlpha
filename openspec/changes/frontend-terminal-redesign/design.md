## Context

当前前端基于 Next.js App Router + Tailwind v4 + shadcn base-nova 构建，视觉上以 macOS 窗口 chrome（`MacWindow` 组件、交通灯按钮、`#f6f5f4` 暖灰基底）和医疗隐喻（scrub green、ECG 动画、vitals 配色）为主。终端风格仅停留在局部 `font-mono` 使用，缺乏系统性的终端视觉语言。

现有组件栈：`MacWindow`、`IconRail`（64px 左侧导航）、`StatusBar`（顶栏）、`ChatView`（聊天+画布分屏）、`InfiniteCanvas`（React Flow）、`CompanyVitalsCard`、`ECGCanvas` 等。遗留代码包括未使用的 `Sidebar`、`Header`、`ViewportPanel`。

## Goals / Non-Goals

**Goals:**
- 在 macOS 窗口框架内注入完整的终端/CRT 视觉层，形成 "macOS Terminal.app" 的混合美学
- 建立 ASCII art 组件体系，用字符画作为品牌元素、装饰和状态表达
- 设计统一的动效系统，涵盖打字机输出、glitch 过渡、boot sequence、光标动画
- 重写聊天界面为命令行交互风格，Phase 展示为终端日志流
- 清理遗留组件，统一设计 token

**Non-Goals:**
- 不改变后端 API、Python Agent 逻辑或数据库结构
- 不替换 React Flow 画布引擎（仅调整节点外观）
- 不引入 Three.js 或 WebGL（纯 CSS/Canvas 2D 实现所有效果）
- 不实现暗色/亮色主题切换（本次仅做终端暗色主题）

## Decisions

### D1: 暗色终端基底 + macOS Chrome 外壳

**选择**：整体切换为暗色背景（深灰/近黑 `oklch(0.12 0.005 250)`），macOS 窗口保留交通灯和标题栏但改为深色玻璃质感。文字用终端绿（`oklch(0.72 0.18 155)`）为主色。

**理由**：终端风格的视觉核心是"暗底亮字"。保留 macOS 窗口 chrome 提供了结构辨识度和亲切感，同时暗色内容区给出了终端沉浸感。相比完全拟物化 CRT 显示器（另一选项），这种方式更现代且不影响可读性。

### D2: CSS-only CRT 效果层，不用 WebGL

**选择**：通过 CSS `::after` 伪元素实现扫描线（repeating-linear-gradient 1px 条纹）、CRT 曲面（微弱 barrel distortion via perspective）、屏幕闪烁（低频 opacity 抖动）。通过 `text-shadow` 实现终端光晕。

**理由**：性能优先。CSS 方案 GPU 加速良好、不增加 bundle size、易于用 CSS 变量全局控制强度。WebGL 方案（如 post-processing shader）虽然效果更逼真，但引入巨大复杂度且对移动端不友好。

### D3: framer-motion 作为动效编排引擎

**选择**：引入 `framer-motion` 处理打字机效果、Phase 过渡动画、Boot sequence 时序编排、列表 stagger 入场。CSS `@keyframes` 仍用于持续循环动画（光标闪烁、扫描线、呼吸灯）。

**理由**：打字机效果需要精确的逐字符时序控制和 SSE 流集成，纯 CSS 无法实现。`framer-motion` 的 `AnimatePresence`、`useMotionValue`、`stagger` 与 React 状态驱动天然匹配。相比 `react-spring`（另一选项），`framer-motion` 的声明式 API 更适合 UI 过渡场景，社区生态更活跃。

### D4: ASCII Art 用预渲染字符串 + 等宽字体，不用 canvas 绘制

**选择**：ASCII art 以 `<pre>` + 等宽字体渲染，存为 TypeScript 常量或独立 `.txt` 引入。动态 ASCII（如加载动画）用帧序列 + `setInterval` 逐帧切换。

**理由**：字符画的核心魅力在于"它就是文本"。用 canvas 绘制反而失去了终端文本的本真感。pre 渲染方案零依赖、SSR 友好、可复制粘贴，且与终端字体完美契合。

### D5: 配色方案——磷光绿为主 + 琥珀色为强调

**选择**：
| Token | 值 | 用途 |
|---|---|---|
| `--term-green` | `oklch(0.72 0.18 155)` | 主文字、品牌色 |
| `--term-green-dim` | `oklch(0.45 0.10 155)` | 次要文字、边框 |
| `--term-amber` | `oklch(0.75 0.16 80)` | 强调、警告、高亮 |
| `--term-cyan` | `oklch(0.70 0.14 195)` | 链接、交互元素 |
| `--term-red` | `oklch(0.65 0.18 25)` | 错误、破坏性操作 |
| `--term-bg` | `oklch(0.12 0.005 250)` | 主背景 |
| `--term-bg-raised` | `oklch(0.16 0.005 250)` | 卡片/面板背景 |
| `--term-bg-surface` | `oklch(0.20 0.005 250)` | 输入框、hover 背景 |
| `--term-glow` | `0 0 8px oklch(0.72 0.18 155 / 40%)` | 文字光晕 |

**理由**：经典磷光绿（P1 荧光粉）是终端视觉的灵魂。琥珀色作为补充色（P3 荧光粉的颜色）在不同信息层级间建立对比。双色方案比全绿更不易视疲劳。

### D6: 聊天输入改为命令行 prompt 风格

**选择**：输入框前置 `user@pharma-alpha:~$` 风格的 prompt 前缀，闪烁方块光标（`█`），按 Enter 发送（Shift+Enter 换行）。Agent 回复以 `[PEC::Plan]`、`[PEC::Execute]` 等 phase 标签前缀呈现。

**理由**：命令行 prompt 是终端交互的标志性元素，比普通输入框更有代入感。Phase 标签对齐了 PEC Agent 的内部流程可视化需求。

### D7: 渐进式增强——CRT 效果可控

**选择**：所有 CRT 装饰效果（扫描线、光晕、曲面失真、屏幕闪烁）通过一个 CSS 类 `.crt-active` 控制，可通过设置页开关。默认开启。

**理由**：CRT 效果虽然视觉震撼，但部分用户可能觉得干扰阅读或影响性能。提供开关是用户友好的做法，也方便开发调试。

## Risks / Trade-offs

- **[可读性]** 暗色终端 + 绿色文字在长文本阅读场景下可能不如浅色背景 → 在 Markdown 渲染区适度提高亮度、增大行距、限制每行宽度 72ch
- **[framer-motion 包体积]** 新增约 30KB gzipped → 通过 tree-shaking 只导入 `motion`、`AnimatePresence`、`stagger` 等必要 API；打字机效果可用轻量自实现替代
- **[CRT 效果性能]** 全屏扫描线叠加在低端设备可能掉帧 → 通过 `will-change: transform` + GPU 层提升 + `.crt-active` 开关兜底
- **[ASCII art 国际化]** 字符画在非等宽字体或 CJK 环境下可能对齐异常 → 强制 `font-family: var(--font-mono)` + 固定 `font-size`
