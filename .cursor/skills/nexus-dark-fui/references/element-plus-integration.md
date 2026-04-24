# Element Plus Dark Mode Integration

Element Plus's `dark/css-vars.css` uses `html.dark {}` selector, which **overrides `:root`** variables. You MUST match or exceed this specificity.

## 1. Variable Overrides (html.dark)

Place in your `variables.css` AFTER `import 'element-plus/theme-chalk/dark/css-vars.css'`:

```css
html.dark {
  /* Primary → Neon Mint Green */
  --el-color-primary: #00FF9F;
  --el-color-primary-light-3: #0D3D2A;
  --el-color-primary-light-5: #0A2E20;
  --el-color-primary-light-7: #071F16;
  --el-color-primary-light-8: #051710;
  --el-color-primary-light-9: #030F0A;
  --el-color-primary-dark-2: #33FFB3;

  /* Success */
  --el-color-success: #34d399;
  --el-color-success-light-3: #143D2D;
  --el-color-success-light-5: #0F2E22;

  /* Warning */
  --el-color-warning: #fbbf24;
  --el-color-warning-light-3: #3D3012;
  --el-color-warning-light-5: #2E240D;

  /* Danger */
  --el-color-danger: #f87171;
  --el-color-danger-light-3: #3D1E1E;
  --el-color-danger-light-5: #2E1717;

  /* Info */
  --el-color-info: #6B7D8E;
  --el-color-info-light-3: #1E2733;
  --el-color-info-light-5: #161B24;

  /* Backgrounds */
  --el-bg-color: #080B10;
  --el-bg-color-page: #020406;
  --el-bg-color-overlay: #0E121A;
  --el-fill-color: #0E121A;
  --el-fill-color-light: #161C26;
  --el-fill-color-lighter: rgba(255, 255, 255, 0.06);
  --el-fill-color-blank: #080B10;

  /* Text */
  --el-text-color-primary: #E6EDF3;
  --el-text-color-regular: #E6EDF3;
  --el-text-color-secondary: #6B7D8E;
  --el-text-color-placeholder: #4A5C6E;
  --el-text-color-disabled: #3A4A5C;

  /* Borders */
  --el-border-color: rgba(255, 255, 255, 0.06);
  --el-border-color-light: rgba(255, 255, 255, 0.08);
  --el-border-color-lighter: rgba(255, 255, 255, 0.06);

  /* Misc */
  --el-mask-color: rgba(0, 0, 0, 0.65);
  --el-box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  --el-box-shadow-light: 0 4px 16px rgba(0, 0, 0, 0.4);
  --el-disabled-bg-color: #0E121A;
  --el-disabled-text-color: #3A4A5C;
  --el-disabled-border-color: rgba(255, 255, 255, 0.04);
  --el-font-family: 'Inter', 'Noto Sans SC', system-ui, -apple-system, sans-serif;
}
```

## 2. Component Property Overrides (!important required)

EP components often use direct CSS properties, not variables. Must use `!important`.

### Buttons — force outline style

```css
.el-button--primary {
  color: var(--nf-accent) !important;
  background-color: transparent !important;
  border-color: var(--nf-accent) !important;
}
.el-button--primary:hover,
.el-button--primary:focus {
  color: var(--nf-accent-hover) !important;
  background-color: rgba(0, 255, 159, 0.06) !important;
  border-color: var(--nf-accent-hover) !important;
}
.el-button--primary.is-disabled,
.el-button--primary.is-disabled:hover {
  color: rgba(0, 255, 159, 0.35) !important;
  background-color: transparent !important;
  border-color: rgba(0, 255, 159, 0.15) !important;
}

/* Same pattern for danger/success/warning/info — all outline-only */
.el-button--danger {
  color: #f87171 !important;
  background-color: transparent !important;
  border-color: #f87171 !important;
}
.el-button--danger:hover { background-color: rgba(248,113,113,0.06) !important; }
```

### Tags — force transparent bg on ALL effects

```css
.el-tag {
  background-color: transparent !important;
}
.el-tag--primary { 
  background-color: rgba(0,255,159,0.06) !important;
  border-color: rgba(0,255,159,0.25) !important;
  color: var(--nf-accent) !important;
}
/* Apply to .el-tag--dark, .el-tag--light, .el-tag--plain equally */
.el-tag--primary.el-tag--dark {
  background-color: rgba(0,255,159,0.06) !important;
  border-color: rgba(0,255,159,0.25) !important;
  color: var(--nf-accent) !important;
}
```

### Checkbox / Radio / Switch

```css
.el-checkbox__inner,
.el-radio__inner {
  background-color: transparent !important;
  border-color: rgba(255,255,255,0.08) !important;
}
.el-checkbox__input.is-checked .el-checkbox__inner {
  background-color: var(--nf-accent) !important;
  border-color: var(--nf-accent) !important;
}
.el-radio__input.is-checked .el-radio__inner {
  background-color: var(--nf-accent) !important;
  border-color: var(--nf-accent) !important;
}
.el-switch.is-checked .el-switch__core {
  background-color: var(--nf-accent) !important;
  border-color: var(--nf-accent) !important;
}
```

### Loading

```css
.el-loading-spinner .circular .path { stroke: var(--nf-accent) !important; }
.el-loading-spinner .el-loading-text { color: var(--nf-accent) !important; }
```

### Radio Button (segmented)

```css
.el-radio-button__inner {
  background-color: transparent !important;
  color: #6B7D8E !important;
  border-color: rgba(255,255,255,0.06) !important;
}
.el-radio-button__original-radio:checked + .el-radio-button__inner {
  background-color: rgba(0,255,159,0.08) !important;
  color: var(--nf-accent) !important;
  border-color: var(--nf-accent) !important;
  box-shadow: -1px 0 0 0 var(--nf-accent) !important;
}
```

## 3. Common Pitfall: `--el-color-primary-light-*`

In dark mode, EP uses `light-3` to `light-9` as **backgrounds** for selected/hover states. Setting bright values (like `#33FFB3`) causes eye-burning fills.

**Always use dark shades:**

| Variant | Value | Used by EP for |
|---------|-------|----------------|
| light-3 | `#0D3D2A` | Checked bg, selected row |
| light-5 | `#0A2E20` | Hover bg |
| light-7 | `#071F16` | Subtle highlight |
| light-9 | `#030F0A` | Barely visible tint |

## 4. Input Override Pattern

```css
:deep(.el-input__wrapper) {
  background: transparent !important;
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: none !important;
}
:deep(.el-input__wrapper.is-focus) {
  border-color: rgba(0,255,159,0.5);
  box-shadow: 0 0 0 3px rgba(0,255,159,0.06) !important;
}
:deep(.el-input__inner) {
  color: #C0CDD8;
  letter-spacing: 0.02em;
}
:deep(.el-input__inner::placeholder) { color: #4A5C6E; }
```
