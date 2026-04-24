# Component Patterns

All components follow **Law 1: Border-Driven State** and **Law 3: Emission, Not Blur**. Background stays transparent; state is expressed through border color plus layered `box-shadow` glow. Glow appears on interaction only — never at rest.

## Page Background

Warm charcoal base with optional faint dot grid (neutral, not accent).

```css
.page {
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.025) 0.5px, transparent 0.5px),
    var(--nf-bg-base);
  background-size: 22px 22px;
  color: var(--nf-text-secondary);
  font-family: var(--nf-font-mono);
}
```

## Card

```css
.card {
  background: var(--nf-bg-surface-alpha);
  border: 1px solid var(--nf-border-invisible);
  border-radius: 6px;
  padding: 20px;
  transition: border-color var(--nf-transition-normal),
              box-shadow  var(--nf-transition-normal);
}
.card:hover {
  border-color: var(--nf-border-visible);
  box-shadow: var(--nf-glow-sm);
}
.card.is-active {
  border-color: rgba(255, 109, 31, 0.4);
  box-shadow: var(--nf-glow-md);
}
```

## Button (outline-only)

Primary CTA emits CRT orange glow on hover. Default/ghost stay neutral.

```css
.btn-primary {
  background: transparent;
  color: var(--nf-accent);
  border: 1px solid var(--nf-accent);
  box-shadow: none;
  font-family: var(--nf-font-mono);
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 4px;
  padding: 8px 18px;
  transition: all var(--nf-transition-normal);
}
.btn-primary:hover {
  background: var(--nf-accent-muted);
  color: var(--nf-accent-hover);
  box-shadow: var(--nf-glow-md);
}
.btn-primary:active {
  box-shadow: var(--nf-glow-inset-sm);
  transform: translateY(0.5px);
}
.btn-primary:disabled {
  color: rgba(255, 109, 31, 0.3);
  border-color: rgba(255, 109, 31, 0.15);
  box-shadow: none;
  cursor: not-allowed;
}

.btn-ghost {
  background: transparent;
  color: var(--nf-text-secondary);
  border: 1px solid var(--nf-border-invisible);
}
.btn-ghost:hover {
  border-color: var(--nf-border-visible);
  color: var(--nf-text-hover);
}

.btn-danger {
  background: transparent;
  color: var(--nf-danger);
  border: 1px solid rgba(217, 106, 94, 0.4);
}
.btn-danger:hover {
  background: rgba(217, 106, 94, 0.06);
  border-color: var(--nf-danger);
}
```

## Tag (pill, border-driven)

```css
.tag {
  font-family: var(--nf-font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 9999px;
  background: transparent;
  border: 1px solid rgba(255, 109, 31, 0.3);
  color: var(--nf-accent);
}
.tag-muted {
  border-color: var(--nf-border-visible);
  color: var(--nf-text-secondary);
}
.tag-danger {
  border-color: rgba(217, 106, 94, 0.35);
  color: var(--nf-danger);
}
.tag.is-selected {
  border-color: rgba(255, 109, 31, 0.5);
  background: var(--nf-accent-muted);
  box-shadow: var(--nf-glow-sm);
}
```

## Tab / Segmented Control

```css
.tab-bar {
  display: inline-flex;
  border: 1px solid var(--nf-border-invisible);
  border-radius: 4px;
  padding: 2px;
  gap: 0;
}
.tab-item {
  padding: 6px 14px;
  background: transparent;
  border: none;
  color: var(--nf-text-secondary);
  font-family: var(--nf-font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 2px;
  transition: all var(--nf-transition-fast);
  cursor: pointer;
}
.tab-item:hover { color: var(--nf-text-hover); }
.tab-item.active {
  color: var(--nf-accent);
  background: var(--nf-accent-muted);
  box-shadow: inset 0 -2px 0 var(--nf-accent);
}
```

## Sidebar / Filter

```css
.filter-item {
  color: var(--nf-text-secondary);
  font-family: var(--nf-font-mono);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  border-radius: 4px;
  padding: 8px 12px;
  border: 1px solid transparent;
  transition: all var(--nf-transition-fast);
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-item:hover {
  color: var(--nf-text-hover);
  border-color: var(--nf-border-invisible);
}
.filter-item.active {
  color: var(--nf-accent);
  border-color: rgba(255, 109, 31, 0.25);
  background: var(--nf-accent-muted);
  box-shadow: inset 2px 0 0 var(--nf-accent);
}
```

## Dialog

```css
.dialog {
  background: var(--nf-bg-elevated);
  border: 1px solid var(--nf-border-visible);
  border-radius: 6px;
  box-shadow: var(--nf-shadow-lg),
              inset 0 1px 0 rgba(255, 255, 255, 0.02);
}
.dialog-header {
  border-bottom: 1px solid var(--nf-border-divider);
  padding: 16px 20px;
}
.dialog-title {
  color: var(--nf-text-primary);
  font-family: var(--nf-font-mono);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
```

## Input

Focus ring is a tight layered shadow — not a fat colored outline.

```css
.input {
  background: transparent;
  border: 1px solid var(--nf-border-invisible);
  border-radius: 4px;
  color: var(--nf-text-input);
  font-family: var(--nf-font-mono);
  font-size: 13px;
  letter-spacing: 0.02em;
  padding: 9px 12px;
  transition: border-color var(--nf-transition-fast),
              box-shadow  var(--nf-transition-fast);
}
.input:hover { border-color: var(--nf-border-visible); }
.input:focus {
  outline: none;
  border-color: rgba(255, 109, 31, 0.5);
  box-shadow: 0 0 0 1px rgba(255, 109, 31, 0.2),
              0 0 6px rgba(255, 109, 31, 0.15);
}
.input::placeholder { color: var(--nf-text-tertiary); }
```

## Inset / Pressed Surface

Use inner glow to suggest inlet surfaces, code blocks, command prompts.

```css
.inset {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--nf-border-invisible);
  border-radius: 4px;
  box-shadow: var(--nf-shadow-inset);
  padding: 12px;
  font-family: var(--nf-font-mono);
}
.inset.is-accent {
  box-shadow: var(--nf-glow-inset-sm);
  border-color: rgba(255, 109, 31, 0.2);
}
```

## Table

```css
.table-header {
  font-family: var(--nf-font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--nf-text-tertiary);
  border-bottom: 1px solid var(--nf-border-divider);
  padding: 8px 12px;
  text-align: left;
}
.table-row {
  border-bottom: 1px solid var(--nf-border-divider);
  transition: background-color var(--nf-transition-fast);
}
.table-row:hover {
  background-color: rgba(255, 255, 255, 0.015);
}
.table-row.is-active {
  background-color: var(--nf-accent-muted);
  box-shadow: inset 2px 0 0 var(--nf-accent);
}
.table-cell {
  font-family: var(--nf-font-mono);
  font-size: 12px;
  color: var(--nf-text-secondary);
  padding: 10px 12px;
}
```

## Terminal Prompt / Data Cursor

The one place text glow is encouraged — mono, tight, restrained.

```css
.prompt::before {
  content: "> ";
  color: var(--nf-accent);
  text-shadow: var(--nf-glow-text);
}
.cursor {
  display: inline-block;
  width: 7px;
  height: 13px;
  background: var(--nf-accent);
  box-shadow: var(--nf-glow-text);
  animation: cursor-blink 1.06s step-end infinite;
  vertical-align: text-bottom;
}
@keyframes cursor-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
```

## Status Dot

Solid fill is allowed here — tiny exception to Law 2.

```css
.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
}
.dot.online  { background: var(--nf-accent); box-shadow: 0 0 4px rgba(255, 109, 31, 0.6); }
.dot.warning { background: var(--nf-warning); }
.dot.danger  { background: var(--nf-danger); }
.dot.idle    { background: var(--nf-text-tertiary); }
```

## Scrollbar

```css
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--nf-scrollbar);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover { background: var(--nf-scrollbar-hover); }
```

## Hero Emission Stack (login / splash only — one per viewport)

```css
.hero-emission {
  box-shadow:
    0 0 0 1px rgba(255, 109, 31, 0.1) inset,
    0 0 10px rgba(255, 109, 31, 0.2),
    0 0 32px rgba(255, 109, 31, 0.1),
    0 0 80px rgba(255, 109, 31, 0.04);
}
```

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
