## ADDED Requirements

### Requirement: Terminal color tokens
系统 SHALL 在 `globals.css` 的 `@theme inline` 中定义完整的终端配色 token 集：`--term-green`、`--term-green-dim`、`--term-amber`、`--term-cyan`、`--term-red`、`--term-bg`、`--term-bg-raised`、`--term-bg-surface`、`--term-glow`。所有新组件 MUST 使用这些 token 而非硬编码颜色值。

#### Scenario: Token 定义完整
- **WHEN** 开发者在 globals.css 中查看 `@theme inline` 块
- **THEN** 包含所有 9 个 `--term-*` token，值使用 oklch 色彩空间

#### Scenario: 现有 shadcn token 保留
- **WHEN** 终端 token 添加后
- **THEN** 原有的 `--background`、`--foreground`、`--primary` 等 token 仍然存在但更新为暗色终端值

### Requirement: Dark terminal body
页面 body MUST 使用 `--term-bg` 作为背景色，默认前景色为 `--term-green`，全局字体 MUST 切换为等宽字体 `var(--font-mono)` 为主字体。

#### Scenario: 页面打开
- **WHEN** 用户打开任意受保护页面
- **THEN** 页面背景为深色（接近 `oklch(0.12 ...)`），文字为磷光绿色，使用等宽字体渲染

### Requirement: CRT scanline overlay
系统 SHALL 提供全局 CRT 扫描线叠加层，通过 `::after` 伪元素实现 1px 条纹 `repeating-linear-gradient`。该效果 MUST 覆盖在所有页面内容之上，`pointer-events: none`。

#### Scenario: CRT 效果可见
- **WHEN** 页面渲染完成且 `.crt-active` 类存在于 body 上
- **THEN** 可见半透明水平扫描线条纹覆盖全屏

#### Scenario: CRT 效果可关闭
- **WHEN** body 上移除 `.crt-active` 类
- **THEN** 扫描线叠加层隐藏

### Requirement: Terminal text glow
所有 `--term-green` 色的文字 MUST 通过 `text-shadow` 添加微弱的磷光辉光效果。辉光强度通过 `--term-glow` token 控制，SHALL 提供 `.glow-none`、`.glow-subtle`、`.glow-normal`、`.glow-strong` 四个等级。

#### Scenario: 默认辉光
- **WHEN** 文字颜色为终端绿
- **THEN** 文字带有轻微的绿色外发光效果（`.glow-normal` 级别）

### Requirement: MacWindow dark variant
`MacWindow` 组件 MUST 支持暗色终端变体：深色半透明背景（`--term-bg-raised` + backdrop-blur）、交通灯保留原色、标题栏文字使用 `--term-green-dim`。

#### Scenario: 聊天面板窗口
- **WHEN** `MacWindow` 在聊天页面渲染
- **THEN** 窗口呈深色玻璃质感，交通灯按钮（红黄绿）正常显示，标题栏文字为暗绿色

### Requirement: Scrollbar terminal styling
滚动条 MUST 更新为终端风格：轨道透明、滑块使用 `--term-green-dim` 低透明度、hover 时亮度提升。

#### Scenario: 滚动可见
- **WHEN** 内容可滚动
- **THEN** 滚动条滑块为暗绿色窄条（6px），与终端风格一致

### Requirement: Clean up legacy components
MUST 删除未使用的 `Sidebar`（`sidebar.tsx`）、`Header`（`header.tsx`）、`ViewportPanel`（`viewport-panel.tsx`）及其关联的 `viewport-store.ts`。

#### Scenario: 构建无引用
- **WHEN** 项目构建完成
- **THEN** 不存在对 `Sidebar`、`Header`、`ViewportPanel` 的任何导入引用
