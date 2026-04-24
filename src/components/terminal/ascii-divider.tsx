"use client";

import { cn } from "@/lib/utils";

const VARIANTS = {
  double: "════════════════════════════════════════════",
  single: "────────────────────────────────────────────",
  diamond: "──── ◆ ──────────────────────────── ◆ ────",
  arrow: ">> ──────────────────────────────────── <<",
  dots: "· · · · · · · · · · · · · · · · · · · · ·",
  wave: "~·~·~·~·~·~·~·~·~·~·~·~·~·~·~·~·~·~·~·~",
} as const;

interface AsciiDividerProps {
  variant?: keyof typeof VARIANTS;
  label?: string;
  className?: string;
}

export function AsciiDivider({
  variant = "single",
  label,
  className,
}: AsciiDividerProps) {
  if (label) {
    const line = VARIANTS[variant];
    const half = Math.floor((line.length - label.length - 4) / 2);
    const left = line.slice(0, Math.max(half, 3));
    const right = line.slice(0, Math.max(half, 3));
    return (
      <div
        className={cn("font-mono text-term-green-dim text-xs select-none", className)}
        role="separator"
      >
        {left} {label} {right}
      </div>
    );
  }

  return (
    <div
      className={cn("font-mono text-term-green-dim text-xs select-none overflow-hidden", className)}
      role="separator"
    >
      {VARIANTS[variant]}
    </div>
  );
}
