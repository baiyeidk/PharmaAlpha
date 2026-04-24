"use client";

import { cn } from "@/lib/utils";

const ILLUSTRATIONS = {
  computer: `
    ┌──────────────────┐
    │  ╔═══════════╗   │
    │  ║  >_       ║   │
    │  ║           ║   │
    │  ║    ░░░░   ║   │
    │  ╚═══════════╝   │
    │   ╔═══════════╗  │
    └───╨═══════════╨──┘`,
  chart: `
       ╭───╮
    ╭──╯   ╰──╮     ╭──
    │          ╰─╮ ╭─╯
    │            ╰─╯
    ╰──────────────────`,
  folder: `
     ╔══════╗
    ╔╝      ╚══════════╗
    ║                   ║
    ║    (empty)        ║
    ║                   ║
    ╚═══════════════════╝`,
  search: `
        ╭────╮
       │      │
       │  ?   │
        ╰──┬─╯
           │╲
           │ ╲
              ╲`,
} as const;

interface AsciiEmptyStateProps {
  illustration?: keyof typeof ILLUSTRATIONS;
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function AsciiEmptyState({
  illustration = "computer",
  title,
  description,
  className,
  children,
}: AsciiEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4 py-12", className)}>
      <pre className="font-mono text-[10px] leading-[12px] text-term-green-dim select-none">
        {ILLUSTRATIONS[illustration].trimStart()}
      </pre>
      <div className="text-center space-y-1">
        <div className="font-mono text-sm text-term-green glow-subtle">{title}</div>
        {description && (
          <div className="font-mono text-xs text-term-green-dim max-w-sm">{description}</div>
        )}
      </div>
      {children}
    </div>
  );
}
