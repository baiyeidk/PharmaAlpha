"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { TimingSummary, TokenUsageSummary } from "@/hooks/use-chat-stream";
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

// DeepSeek pricing (2026.04, USD per 1M tokens). Used only as a hint.
const DEEPSEEK_PRICING = {
  cacheHitInput: 0.028,
  cacheMissInput: 0.28,
  output: 0.42,
};

interface TimingPanelProps {
  summary: TimingSummary;
  tokenSummary?: TokenUsageSummary;
}

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

function fmtTokens(n: number): string {
  if (!n) return "0";
  if (n < 1000) return `${n}`;
  if (n < 10_000) return `${(n / 1000).toFixed(2)}k`;
  return `${(n / 1000).toFixed(1)}k`;
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, (part / total) * 100);
}

function estimateCostUSD(ts: TokenUsageSummary): number {
  const cached = ts.cachedTokens;
  const promptMiss = Math.max(0, ts.promptTokens - cached);
  return (
    (cached / 1_000_000) * DEEPSEEK_PRICING.cacheHitInput +
    (promptMiss / 1_000_000) * DEEPSEEK_PRICING.cacheMissInput +
    (ts.completionTokens / 1_000_000) * DEEPSEEK_PRICING.output
  );
}

export function TimingPanel({ summary, tokenSummary }: TimingPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [tab, setTab] = useState<"latency" | "tokens">("latency");

  const total = summary.totalMs;
  const knownPhaseTotal = PHASE_ORDER.reduce(
    (acc, p) => acc + (summary.byPhase[p] || 0),
    0,
  );
  const otherMs = Math.max(0, total - knownPhaseTotal);

  const totalTokens = tokenSummary?.totalTokens || 0;
  const cost = tokenSummary ? estimateCostUSD(tokenSummary) : 0;

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
          Latency · Tokens
        </span>
        <span className="text-xs text-term-amber glow-subtle">
          {fmtMs(total)}
        </span>
        {totalTokens > 0 && (
          <span className="text-xs text-term-cyan/80">
            {fmtTokens(totalTokens)} tok
          </span>
        )}
        {!collapsed && (
          <span className="text-[10px] text-term-green-dim ml-auto">
            {summary.llmCalls.length} llm · {summary.toolCalls.length} tool
            {cost > 0 ? ` · ~$${cost.toFixed(5)}` : ""}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-term-green/10">
          <div className="flex items-center gap-1 px-3 pt-2">
            <button
              onClick={() => setTab("latency")}
              className={cn(
                "px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-sm transition-colors",
                tab === "latency"
                  ? "bg-term-amber/15 text-term-amber"
                  : "text-term-green-dim hover:text-foreground",
              )}
            >
              Latency
            </button>
            <button
              onClick={() => setTab("tokens")}
              disabled={!tokenSummary || tokenSummary.callCount === 0}
              className={cn(
                "px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-sm transition-colors disabled:opacity-30",
                tab === "tokens"
                  ? "bg-term-cyan/15 text-term-cyan"
                  : "text-term-green-dim hover:text-foreground",
              )}
            >
              Tokens
            </button>
          </div>

          {tab === "latency" && (
            <div className="px-3 pb-3 pt-1 space-y-2">
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
                        {fmtMs(ms)}
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
                      {fmtMs(otherMs)}
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
                          <span className="text-term-amber">{fmtMs(ms)}</span>
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
                  <div className="flex flex-col gap-0.5">
                    {summary.llmCalls.map((c, i) => (
                      <div key={i} className="text-foreground/70 flex flex-wrap gap-x-2">
                        <span className="text-term-cyan">{c.phaseOwner}</span>
                        <span className="text-term-green-dim/70">
                          {c.loop ? `L${c.loop}` : ""}
                          {c.stream ? "·stream" : "·json"}
                        </span>
                        <span className="text-term-amber">{fmtMs(c.elapsedMs)}</span>
                        {c.totalTokens ? (
                          <span className="text-term-cyan/70">
                            {fmtTokens(c.totalTokens)}t (
                            <span className="text-foreground/70">
                              {fmtTokens(c.promptTokens || 0)}↑/
                              {fmtTokens(c.completionTokens || 0)}↓
                            </span>
                            {c.cachedTokens ? (
                              <span className="text-term-green-dim">
                                · cache {fmtTokens(c.cachedTokens)}
                              </span>
                            ) : null}
                            )
                          </span>
                        ) : null}
                      </div>
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
                        <span className="text-term-amber">{fmtMs(c.elapsedMs)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "tokens" && tokenSummary && (
            <div className="px-3 pb-3 pt-1 space-y-3">
              <div className="grid grid-cols-4 gap-2 text-[11px]">
                <Stat label="Prompt" value={fmtTokens(tokenSummary.promptTokens) + " tok"} accent="cyan" />
                <Stat label="Completion" value={fmtTokens(tokenSummary.completionTokens) + " tok"} accent="cyan" />
                <Stat label="Cached" value={fmtTokens(tokenSummary.cachedTokens) + " tok"} accent="dim" />
                <Stat
                  label="~Cost (DS)"
                  value={cost > 0 ? `$${cost.toFixed(5)}` : "—"}
                  accent="amber"
                />
              </div>

              <div className="pt-2 border-t border-term-green/10">
                <div className="text-[10px] text-term-green-dim mb-1 uppercase tracking-wider">
                  By phase
                </div>
                <div className="space-y-1">
                  {Object.entries(tokenSummary.byPhaseOwner)
                    .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
                    .map(([owner, slot]) => {
                      const ratio = pct(slot.totalTokens, tokenSummary.totalTokens);
                      return (
                        <div key={owner} className="text-[11px] flex items-center gap-2">
                          <span className="text-term-green-dim w-24 shrink-0">{owner}</span>
                          <div className="flex-1 h-1.5 bg-term-green/5 rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-term-cyan/60"
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                          <span className="text-foreground/80 w-20 text-right tabular-nums">
                            {fmtTokens(slot.totalTokens)} tok
                          </span>
                          <span className="text-term-green-dim/70 w-10 text-right tabular-nums">
                            ×{slot.callCount}
                          </span>
                          <span className="text-term-green-dim/70 w-12 text-right tabular-nums">
                            {ratio.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="pt-2 border-t border-term-green/10 text-[10px] text-term-green-dim/80 leading-relaxed">
                <div>
                  Cache ratio:{" "}
                  <span className="text-foreground/80">
                    {tokenSummary.promptTokens > 0
                      ? `${((tokenSummary.cachedTokens / tokenSummary.promptTokens) * 100).toFixed(1)}%`
                      : "—"}
                  </span>{" "}
                  · Avg per call:{" "}
                  <span className="text-foreground/80">
                    {fmtTokens(
                      Math.round(tokenSummary.totalTokens / Math.max(1, tokenSummary.callCount)),
                    )}{" "}
                    tok
                  </span>
                </div>
                <div className="mt-0.5">
                  Cost is a hint based on DeepSeek public pricing
                  (cache-hit ${DEEPSEEK_PRICING.cacheHitInput}/M, cache-miss ${DEEPSEEK_PRICING.cacheMissInput}/M, output ${DEEPSEEK_PRICING.output}/M).
                  Real billing depends on the active provider.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "cyan" | "amber" | "dim";
}) {
  const tone =
    accent === "cyan" ? "text-term-cyan" : accent === "amber" ? "text-term-amber" : "text-foreground/70";
  return (
    <div className="rounded-sm bg-term-bg-surface/60 border border-term-green/10 px-2 py-1">
      <div className="text-[9px] text-term-green-dim uppercase tracking-wider">{label}</div>
      <div className={cn("text-[12px] tabular-nums mt-0.5", tone)}>{value}</div>
    </div>
  );
}
