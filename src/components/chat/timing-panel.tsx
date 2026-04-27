"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { TimingSummary } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<string, string> = {
  memory_recall: "Memory Recall",
  rag_search: "RAG Pre-Search",
  plan: "Plan",
  execute: "Execute",
  check: "Check",
  synthesize: "Synthesize",
  total: "Total",
};

const PHASE_ORDER = [
  "memory_recall",
  "rag_search",
  "plan",
  "execute",
  "check",
  "synthesize",
];

interface TimingPanelProps {
  summary: TimingSummary;
}

function fmt(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

function pct(ms: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, (ms / total) * 100);
}

export function TimingPanel({ summary }: TimingPanelProps) {
  const [collapsed, setCollapsed] = useState(true);

  const total = summary.totalMs;
  const knownPhaseTotal = PHASE_ORDER.reduce(
    (acc, p) => acc + (summary.byPhase[p] || 0),
    0,
  );
  const otherMs = Math.max(0, total - knownPhaseTotal);

  return (
    <div className="my-3 font-mono border border-term-green/15 rounded-sm bg-term-bg/50">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-left cursor-pointer"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-term-green-dim transition-transform shrink-0",
            !collapsed && "rotate-90",
          )}
        />
        <span className="text-[10px] text-term-green-dim uppercase tracking-wider">
          Latency
        </span>
        <span className="text-xs text-term-amber glow-subtle">
          Total · {fmt(total)}
        </span>
        {!collapsed && (
          <span className="text-[10px] text-term-green-dim ml-auto">
            {summary.llmCalls.length} llm calls · {summary.toolCalls.length} tool calls
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-term-green/10">
          <div className="space-y-1">
            {PHASE_ORDER.map((p) => {
              const ms = summary.byPhase[p] || 0;
              if (ms === 0 && p !== "memory_recall" && p !== "rag_search") return null;
              const ratio = pct(ms, total);
              return (
                <div key={p} className="text-[11px] flex items-center gap-2">
                  <span className="text-term-green-dim w-28 shrink-0">
                    {PHASE_LABELS[p] || p}
                  </span>
                  <div className="flex-1 h-1.5 bg-term-green/5 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-term-amber/70"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  <span className="text-foreground/80 w-16 text-right tabular-nums">
                    {fmt(ms)}
                  </span>
                  <span className="text-term-green-dim/70 w-12 text-right tabular-nums">
                    {ratio.toFixed(0)}%
                  </span>
                </div>
              );
            })}
            {otherMs > 50 && (
              <div className="text-[11px] flex items-center gap-2 opacity-60">
                <span className="text-term-green-dim w-28 shrink-0">Overhead</span>
                <div className="flex-1 h-1.5 bg-term-green/5 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-term-green-dim/40"
                    style={{ width: `${pct(otherMs, total)}%` }}
                  />
                </div>
                <span className="text-foreground/60 w-16 text-right tabular-nums">
                  {fmt(otherMs)}
                </span>
                <span className="text-term-green-dim/70 w-12 text-right tabular-nums">
                  {pct(otherMs, total).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {summary.perRoundExecuteMs.filter(Boolean).length > 1 && (
            <div className="pt-2 border-t border-term-green/10 text-[10px]">
              <div className="text-term-green-dim mb-1">Execute per round</div>
              <div className="flex flex-wrap gap-2">
                {summary.perRoundExecuteMs.map((ms, i) =>
                  ms ? (
                    <span key={i} className="text-foreground/70">
                      R{i + 1}:{" "}
                      <span className="text-term-amber">{fmt(ms)}</span>
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          )}

          {summary.llmCalls.length > 0 && (
            <div className="pt-2 border-t border-term-green/10 text-[10px]">
              <div className="text-term-green-dim mb-1">
                LLM calls ({summary.llmCalls.length})
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {summary.llmCalls.map((c, i) => (
                  <span key={i} className="text-foreground/70">
                    <span className="text-term-cyan">{c.phaseOwner}</span>
                    {c.loop ? `·L${c.loop}` : ""}
                    {c.stream ? "·stream" : "·json"}{" "}
                    <span className="text-term-amber">{fmt(c.elapsedMs)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {summary.toolCalls.length > 0 && (
            <div className="pt-2 border-t border-term-green/10 text-[10px]">
              <div className="text-term-green-dim mb-1">
                Tool calls ({summary.toolCalls.length})
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {summary.toolCalls.map((c, i) => (
                  <span
                    key={i}
                    className={cn(
                      "text-foreground/70",
                      c.success === false && "text-term-red/80",
                    )}
                  >
                    <span className="text-term-cyan">{c.name}</span>{" "}
                    <span className="text-term-amber">{fmt(c.elapsedMs)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
