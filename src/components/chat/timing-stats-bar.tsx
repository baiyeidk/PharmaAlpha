"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { TimingStats } from "@/hooks/use-timing-stats";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<string, string> = {
  memory_recall: "Memory",
  rag_search: "RAG",
  plan: "Plan",
  execute: "Execute",
  check: "Check",
  synthesize: "Synthesize",
};

const PHASE_ORDER = [
  "memory_recall",
  "rag_search",
  "plan",
  "execute",
  "check",
  "synthesize",
];

interface TimingStatsBarProps {
  stats: TimingStats;
  onClear?: () => void;
}

function fmt(ms: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

export function TimingStatsBar({ stats, onClear }: TimingStatsBarProps) {
  const [open, setOpen] = useState(false);
  if (stats.count === 0) return null;

  const orderedRows = PHASE_ORDER
    .map((p) => stats.rows.find((r) => r.phase === p))
    .filter((r): r is NonNullable<typeof r> => !!r && r.count > 0);

  return (
    <div className="font-mono">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-1 text-[10px] rounded-sm",
          "border border-term-green/15 bg-term-bg/50 hover:bg-term-bg/80 transition-colors",
        )}
        title={`Based on the last ${stats.count} request(s) in this browser`}
      >
        <span className="text-term-green-dim uppercase tracking-wider">
          Latency · n={stats.count}
        </span>
        <span className="text-foreground/80">
          P50 <span className="text-term-amber">{fmt(stats.totalP50)}</span>
        </span>
        <span className="text-foreground/80">
          P95 <span className="text-term-amber">{fmt(stats.totalP95)}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-term-green-dim transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-1 rounded-sm border border-term-green/15 bg-term-bg/95 p-3 shadow-lg min-w-[420px]">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-term-green/10">
            <span className="text-[10px] text-term-green-dim uppercase tracking-wider">
              Per-phase percentiles
            </span>
            <span className="text-[10px] text-foreground/60 ml-auto">
              {stats.count} samples · avg total {fmt(stats.totalAvg)}
            </span>
            {onClear && (
              <button
                onClick={onClear}
                className="text-term-green-dim hover:text-term-red transition-colors"
                title="Clear samples"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <table className="w-full text-[11px] tabular-nums">
            <thead>
              <tr className="text-term-green-dim text-[10px] uppercase tracking-wider">
                <th className="text-left font-normal pb-1">Phase</th>
                <th className="text-right font-normal pb-1">P50</th>
                <th className="text-right font-normal pb-1">P95</th>
                <th className="text-right font-normal pb-1">Avg</th>
                <th className="text-right font-normal pb-1">N</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-term-green/10">
                <td className="text-term-amber py-0.5">Total</td>
                <td className="text-right text-term-amber">{fmt(stats.totalP50)}</td>
                <td className="text-right text-term-amber">{fmt(stats.totalP95)}</td>
                <td className="text-right text-term-amber">{fmt(stats.totalAvg)}</td>
                <td className="text-right text-foreground/60">{stats.count}</td>
              </tr>
              {orderedRows.map((row) => (
                <tr key={row.phase}>
                  <td className="text-foreground/80 py-0.5">
                    {PHASE_LABELS[row.phase] || row.phase}
                  </td>
                  <td className="text-right text-foreground/90">{fmt(row.p50)}</td>
                  <td className="text-right text-foreground/90">{fmt(row.p95)}</td>
                  <td className="text-right text-foreground/70">{fmt(row.avg)}</td>
                  <td className="text-right text-foreground/60">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
