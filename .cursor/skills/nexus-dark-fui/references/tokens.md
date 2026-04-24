# Design Tokens — CSS Custom Properties

Copy-paste ready for your root stylesheet. Palette: warm charcoal + restrained vacuum-tube orange.

## Elevation

Warm charcoal, slight hue bias toward neutral-warm (NOT cool blue).

```css
--nf-bg-base:      #0a0a0b;
--nf-bg-surface:   #0e0e10;
--nf-bg-elevated:  #141416;
--nf-bg-top:       #18181b;

--nf-bg-base-alpha:     rgba(10, 10, 11, 0.92);
--nf-bg-surface-alpha:  rgba(14, 14, 16, 0.88);
--nf-bg-elevated-alpha: rgba(20, 20, 22, 0.85);
--nf-bg-top-alpha:      rgba(24, 24, 27, 0.8);
```

## Text

Warm off-white, no pure white, dimmed secondary.

```css
--nf-text-primary:   #e8e6e3;
--nf-text-secondary: #a0998f;
--nf-text-tertiary:  #6b6560;
--nf-text-hover:     #c7c1b8;
--nf-text-input:     #d4cec4;
--nf-text-disabled:  #4a4540;
```

## Accent — Vacuum-Tube Orange

Used sparingly (<8% of UI). Never solid-filled on large surfaces.

```css
--nf-accent:        #ff6d1f;
--nf-accent-hover:  #ff8540;
--nf-accent-muted:  rgba(255, 109, 31, 0.06);
--nf-accent-dim:    #c94a00;  /* pressed / secondary */
--nf-accent2:       #e85a15;  /* deeper orange for layered accents */
```

## Borders

Thin, low contrast, warm-neutral.

```css
--nf-border-invisible: rgba(255, 255, 255, 0.05);
--nf-border-subtle:    rgba(255, 255, 255, 0.07);
--nf-border-visible:   #2a2a2a;
--nf-border-strong:    #3a3a3a;
--nf-border-divider:   #1a1a1c;
```

## Glow — Layered Shadow (CRT Emission)

No `filter: blur()`. Stack `box-shadow` layers to simulate phosphor decay.

```css
/* outer emission — hover / active */
--nf-glow-sm:  0 0 4px rgba(255, 109, 31, 0.25);
--nf-glow-md:  0 0 1px rgba(255, 109, 31, 0.5),
               0 0 8px rgba(255, 109, 31, 0.28);
--nf-glow-lg:  0 0 1px rgba(255, 109, 31, 0.6),
               0 0 10px rgba(255, 109, 31, 0.32),
               0 0 28px rgba(255, 109, 31, 0.12);

/* inner emission — pressed / inset surfaces */
--nf-glow-inset-sm: inset 0 0 6px rgba(255, 109, 31, 0.08),
                    inset 0 1px 0 rgba(0, 0, 0, 0.4);
--nf-glow-inset-md: inset 0 0 10px rgba(255, 109, 31, 0.12),
                    inset 0 1px 0 rgba(0, 0, 0, 0.5);

/* text emission — sparingly for data cursor / prompt */
--nf-glow-text: 0 0 6px rgba(255, 109, 31, 0.45);

/* hero-tier (login, splash only) */
--nf-glow-massive: 0 0 1px rgba(255, 109, 31, 0.7),
                   0 0 12px rgba(255, 109, 31, 0.25),
                   0 0 40px rgba(255, 109, 31, 0.08),
                   0 0 100px rgba(255, 109, 31, 0.04);
```

## Fonts

Monospace is the default for all UI chrome. Display font is a fallback for prose.

```css
--nf-font-mono:    'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', ui-monospace, monospace;
--nf-font-display: 'Inter', 'Noto Sans SC', system-ui, -apple-system, sans-serif;
```

### Local hosting (recommended)

```ts
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
```

### Font rendering

```css
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-feature-settings: 'calt', 'zero';
}
```

## Semantic Colors

Muted, never saturated. Align hue with warm palette.

```css
--nf-danger:        #d96a5e;
--nf-danger-muted:  rgba(217, 106, 94, 0.1);
--nf-warning:       #e0a848;
--nf-warning-muted: rgba(224, 168, 72, 0.1);
--nf-success:       #8fbf7a;
--nf-success-muted: rgba(143, 191, 122, 0.1);
--nf-info:          #8a9da8;
--nf-info-muted:    rgba(138, 157, 168, 0.08);
```

## Shadows — Depth (non-emissive)

```css
--nf-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
--nf-shadow-md: 0 2px 8px rgba(0, 0, 0, 0.45);
--nf-shadow-lg: 0 6px 24px rgba(0, 0, 0, 0.55);

--nf-shadow-inset:     inset 0 1px 0 rgba(255, 255, 255, 0.02),
                       inset 0 -1px 0 rgba(0, 0, 0, 0.3);
--nf-shadow-pressed:   inset 0 2px 4px rgba(0, 0, 0, 0.4);
```

## Scrollbar

```css
--nf-scrollbar:       rgba(255, 255, 255, 0.06);
--nf-scrollbar-hover: rgba(255, 109, 31, 0.25);
```

## Overlay

```css
--nf-loading-mask: rgba(10, 10, 11, 0.85);
--nf-overlay:      rgba(0, 0, 0, 0.7);
--nf-overlay-blur: rgba(0, 0, 0, 0.4);
```

## Micro-Grid (subtle, optional)

Dot grid uses warm-neutral specks, not accent color (accent would push past the 8% ceiling).

```css
--nf-grid-color: rgba(255, 255, 255, 0.025);
--nf-grid-size:  22px;
```

## Motion

```css
--nf-transition-fast:   150ms ease;
--nf-transition-normal: 200ms ease;
--nf-transition-slow:   250ms ease;
```

## CJK Letter-Spacing

| Context | Latin | CJK |
|---------|-------|-----|
| Page title | 0.06em | 0.08em |
| Section header | 0.05em | 0.07em |
| Subtitle | 0.03em | 0.05em |
| Body | 0.01em | 0.03em |
| Nano | 0.12em | 0.14em |
