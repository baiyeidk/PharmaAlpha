"use client";

import { ECGCanvas } from "@/components/ui/ecg-canvas";

interface Props {
  email: string;
  initials: string;
}

export function StatusBarClient({ email, initials }: Props) {
  return (
    <header className="relative flex h-11 items-center justify-between border-b border-border bg-marrow/50 px-4 font-mono text-xs tracking-wider overflow-hidden">
      {/* ECG 背景 */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
        <ECGCanvas
          condition="healthy"
          color="oklch(0.42 0.14 160)"
          height={44}
          speed={1}
          lineWidth={1}
        />
      </div>

      <div className="relative flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-scrub">
          <div className="h-2 w-2 rounded-full bg-scrub animate-pulse-glow" />
          系统正常
        </div>
        <div className="h-2.5 w-px bg-border" />
        <span className="text-muted-foreground">分析就绪</span>
        <div className="h-2.5 w-px bg-border" />
        <span className="text-muted-foreground text-xs">
          {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      <div className="relative flex items-center gap-3">
        <span className="text-muted-foreground text-xs">{email}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-scrub/30 bg-scrub/10 text-xs font-bold text-scrub">
          {initials}
        </div>
      </div>
    </header>
  );
}
