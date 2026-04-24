"use client";

import { cn } from "@/lib/utils";

const STATUS_MAP = {
  ok: { label: "[ OK ]", color: "text-term-green", glow: "glow-subtle" },
  fail: { label: "[FAIL]", color: "text-term-red", glow: "glow-subtle" },
  wait: { label: "[WAIT]", color: "text-term-amber", glow: "glow-subtle" },
  run: { label: "[ ▶ ]", color: "text-term-cyan", glow: "glow-subtle" },
  warn: { label: "[WARN]", color: "text-term-amber", glow: "glow-subtle" },
  info: { label: "[INFO]", color: "text-term-green-dim", glow: "glow-none" },
} as const;

interface AsciiStatusBadgeProps {
  status: keyof typeof STATUS_MAP;
  label?: string;
  className?: string;
}

export function AsciiStatusBadge({ status, label, className }: AsciiStatusBadgeProps) {
  const { label: defaultLabel, color, glow } = STATUS_MAP[status];
  return (
    <span className={cn("font-mono text-xs inline-flex items-center gap-1", color, glow, className)}>
      {label ?? defaultLabel}
    </span>
  );
}
