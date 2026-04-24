---
name: nexus-dark-fui-system
description: >-
  Retro-futuristic terminal + industrial Dark UI protocol. Restraint over
  spectacle. Warm charcoal surfaces, vacuum-tube orange emission. Optimized
  for developer tools, dashboards, and technical consoles that should feel
  calm, nostalgic, and precise.
---

# Nexus Dark FUI — Design Protocol

> Calm, technical, slightly nostalgic. The aesthetic emerges from warm charcoal surfaces and restrained CRT-style emission. NOT gaming UI, NOT cyberpunk, NOT sci-fi overload.

## Three Foundational Laws

### Law 1: Border-Driven State

State changes are expressed through **border color shifts** and **layered shadow glow**, NOT background fills.

- Default → `rgba(255,255,255,0.05)` invisible border
- Hover → `#2a2a2a` visible border + soft outer glow appears
- Active → `rgba(255,109,31,0.4)` accent border + CRT emission glow
- Background stays `transparent` or `rgba(accent, 0.05)` max

Applies to: buttons, tags, cards, tabs, list items, table rows, checkboxes, radio buttons.

### Law 2: Accent Restraint (<8%)

- Accent orange `#ff6d1f` must occupy less than 8% of any viewport.
- Max button/tag fill: `rgba(255,109,31,0.06)` on hover (never solid).
- No pure white (`#FFF`). Max text brightness: `#e8e6e3` (slightly warm off-white).
- Only exception for solid accent: notification count badges, status dots.

### Law 3: Emission, Not Blur

- Glow is built from **layered `box-shadow` stacks**, never `filter: blur()`.
- Simulates vacuum-tube / CRT phosphor emission — warm, tight, slightly soft.
- Glow appears on **hover/focus/active only**, never always-on ambient glow.
- No decorative gradients. No conic sweeps. No animated borders outside hero pages.

### Law 4: Typography Size Ceiling

No text exceeds `22px`. Information density > dramatic headlines.

---

## Elevation (Z-Axis)

Warm charcoal, slight hue shift toward `#1x1x1x` (not cool blue).

| Layer | Token | Value | Context |
|-------|-------|-------|---------|
| 0 Void | `--nf-bg-base` | `#0a0a0b` | Page background |
| 1 Floor | `--nf-bg-surface` | `#0e0e10` | Cards, content |
| 2 Panel | `--nf-bg-elevated` | `#141416` | Modals, sidebars |
| 3 Float | `--nf-bg-top` | `#18181b` | Tooltips, dropdowns |

Never invert: children always go **upward** in luminance.

## Typography

| Level | Size | Weight | Spacing | Font |
|-------|------|--------|---------|------|
| H1 | 18–22px | 600 | 0.06em | Mono |
| H2 | 14–16px | 500 | 0.05em | Mono |
| Body | 13–14px | 400 | 0.01em | Mono |
| Small | 12px | 400 | 0.03em | Mono |
| Nano | 10px | 600 | 0.12em+UPPER | Mono |
| Data | 11–13px | 400 | 0.02em | Mono |

**Fonts**: `--nf-font-mono` (JetBrains Mono / IBM Plex Mono) for **all UI** — the semi-monospace feel is core to the aesthetic. `--nf-font-display` (Inter + Noto Sans SC) only for prose paragraphs when density would hurt readability.

**CJK Rules**: Max weight `500` (never 700 — ink bleed on warm dark). Headers `letter-spacing: 0.05–0.08em`. Body `line-height: 1.75`.

## Text Hierarchy

| Tier | Hex | Usage |
|------|-----|-------|
| Primary | `#e8e6e3` | Titles, headings — warm off-white |
| Secondary | `#a0998f` | Subtitles, labels — dimmed warm gray |
| Tertiary | `#6b6560` | Timestamps, placeholders |
| Hover | `#c7c1b8` | Interactive hover only |
| Input | `#d4cec4` | Field values |

## State Matrix

| State | Border | Background | Text | Glow |
|-------|--------|------------|------|------|
| Default | `rgba(255,255,255,0.05)` | transparent | `#a0998f` | — |
| Hover | `#2a2a2a` | transparent | `#c7c1b8` | sm outer |
| Active | `rgba(255,109,31,0.4)` | `rgba(255,109,31,0.06)` | `#ff6d1f` | md outer |
| Focus | `rgba(255,109,31,0.5)` | transparent | unchanged | focus ring |
| Pressed | `#2a2a2a` | `rgba(0,0,0,0.3)` | `#a0998f` | sm **inner** |
| Disabled | `rgba(255,255,255,0.03)` | transparent | `#4a4540` | — |

## Accent Usage

| Element | When accent is allowed |
|---------|------------------------|
| Primary CTA | one per viewport |
| Active tab / selected item | yes |
| Focus ring | yes |
| Status dot (online/running) | yes |
| Data cursor, terminal prompt `>` | yes |
| Headings, body, icons | **no** — stay neutral |
| Large surfaces | **never** |

## Motion

- Transitions: `150–250ms ease` only. No bounce, no spring.
- Hover glow fades in over `200ms`. No flashing, no pulsing (except explicit status).
- Respect `prefers-reduced-motion`.

## Do's and Don'ts

**DO**: Monospace everywhere · Express state via border + layered shadow · Outline-only buttons/tags · Warm charcoal surfaces · Glow on hover/focus only · CJK spacing `0.05em+` · Inner shadow for inset/pressed surfaces.

**DON'T**: Solid accent fills · Pure `#FFFFFF` text · Neon saturation · `filter: blur()` glow · Cyberpunk gradients · Always-on ambient glow · `font-size > 22px` · Sans-serif for data/UI chrome · Cold blue-gray surfaces.

## New Page Checklist

1. Root: mono font stack + warm charcoal background with optional faint dot grid
2. Title: H1 mono, `#e8e6e3`, `0.06em`
3. Cards: surface-alpha bg + invisible border + outer glow on hover only
4. Buttons: outline-only; primary gets CRT emission glow on hover
5. Tags: transparent bg + accent border `0.3α`, uppercase mono
6. Tables: Nano uppercase mono headers
7. Inputs: transparent bg, accent focus ring with layered shadow
8. Accent audit: visually scan — accent should feel like <8% of the page
9. Motion check: no element glows at rest; all emission is interaction-triggered

## References (read on demand)

| Need | File |
|------|------|
| CSS custom properties (copy-paste) | [references/tokens.md](references/tokens.md) |
| Component code patterns (Card, Button, Tag, Tab, Dialog, Input, Table) | [references/component-patterns.md](references/component-patterns.md) |
| Element Plus dark override guide + pitfalls | [references/element-plus-integration.md](references/element-plus-integration.md) |
