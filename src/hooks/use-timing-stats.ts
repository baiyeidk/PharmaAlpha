"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TimingSummary, TokenUsageSummary } from "./use-chat-stream";

const STORAGE_KEY = "pharma:timing-stats:v2";
const MAX_SAMPLES = 50;

export interface TimingSample {
  ts: number;
  totalMs: number;
  byPhase: Record<string, number>;
  llmCallCount: number;
  toolCallCount: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
}

export interface PercentileRow {
  phase: string;
  p50: number;
  p95: number;
  avg: number;
  count: number;
}

export interface TokenStats {
  totalP50: number;
  totalP95: number;
  totalAvg: number;
  promptP50: number;
  completionP50: number;
  cachedP50: number;
  cacheHitRateAvg: number;
}

export interface TimingStats {
  count: number;
  totalP50: number;
  totalP95: number;
  totalAvg: number;
  rows: PercentileRow[];
  recent: TimingSample[];
  tokens: TokenStats;
}

function readSamples(): TimingSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_SAMPLES) : [];
  } catch {
    return [];
  }
}

function writeSamples(samples: TimingSample[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch {
    // Quota exceeded; drop silently.
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

const EMPTY_TOKEN_STATS: TokenStats = {
  totalP50: 0,
  totalP95: 0,
  totalAvg: 0,
  promptP50: 0,
  completionP50: 0,
  cachedP50: 0,
  cacheHitRateAvg: 0,
};

function summarize(samples: TimingSample[]): TimingStats {
  if (samples.length === 0) {
    return {
      count: 0,
      totalP50: 0,
      totalP95: 0,
      totalAvg: 0,
      rows: [],
      recent: [],
      tokens: EMPTY_TOKEN_STATS,
    };
  }
  const totals = samples.map((s) => s.totalMs).sort((a, b) => a - b);
  const phases = new Set<string>();
  samples.forEach((s) => Object.keys(s.byPhase).forEach((p) => phases.add(p)));

  const rows: PercentileRow[] = Array.from(phases).map((phase) => {
    const xs = samples
      .map((s) => s.byPhase[phase])
      .filter((v): v is number => typeof v === "number" && v > 0)
      .sort((a, b) => a - b);
    return {
      phase,
      p50: percentile(xs, 50),
      p95: percentile(xs, 95),
      avg: avg(xs),
      count: xs.length,
    };
  });

  const tokenSamples = samples.filter(
    (s): s is TimingSample & { totalTokens: number } =>
      typeof s.totalTokens === "number" && s.totalTokens > 0,
  );
  const tokenTotals = tokenSamples.map((s) => s.totalTokens).sort((a, b) => a - b);
  const promptVals = tokenSamples.map((s) => s.promptTokens || 0).sort((a, b) => a - b);
  const completionVals = tokenSamples.map((s) => s.completionTokens || 0).sort((a, b) => a - b);
  const cachedVals = tokenSamples.map((s) => s.cachedTokens || 0).sort((a, b) => a - b);
  const cacheHitRates = tokenSamples
    .map((s) => ((s.cachedTokens || 0) / Math.max(1, s.promptTokens || 0)) * 100)
    .filter((r) => r >= 0);

  const tokens: TokenStats =
    tokenSamples.length === 0
      ? EMPTY_TOKEN_STATS
      : {
          totalP50: percentile(tokenTotals, 50),
          totalP95: percentile(tokenTotals, 95),
          totalAvg: avg(tokenTotals),
          promptP50: percentile(promptVals, 50),
          completionP50: percentile(completionVals, 50),
          cachedP50: percentile(cachedVals, 50),
          cacheHitRateAvg: avg(cacheHitRates),
        };

  return {
    count: samples.length,
    totalP50: percentile(totals, 50),
    totalP95: percentile(totals, 95),
    totalAvg: avg(totals),
    rows,
    recent: samples.slice(-10),
    tokens,
  };
}

export function useTimingStats() {
  const [stats, setStats] = useState<TimingStats>(() => summarize(readSamples()));
  const seenKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setStats(summarize(readSamples()));
  }, []);

  const record = useCallback(
    (key: string, summary: TimingSummary, tokenSummary?: TokenUsageSummary) => {
      if (!summary || summary.totalMs <= 0) return;
      if (seenKeysRef.current.has(key)) return;
      seenKeysRef.current.add(key);

      const sample: TimingSample = {
        ts: Date.now(),
        totalMs: summary.totalMs,
        byPhase: { ...summary.byPhase },
        llmCallCount: summary.llmCalls.length,
        toolCallCount: summary.toolCalls.length,
        ...(tokenSummary && tokenSummary.callCount > 0
          ? {
              promptTokens: tokenSummary.promptTokens,
              completionTokens: tokenSummary.completionTokens,
              totalTokens: tokenSummary.totalTokens,
              cachedTokens: tokenSummary.cachedTokens,
            }
          : {}),
      };
      const next = [...readSamples(), sample].slice(-MAX_SAMPLES);
      writeSamples(next);
      setStats(summarize(next));
    },
    [],
  );

  const clear = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    seenKeysRef.current = new Set();
    setStats(summarize([]));
  }, []);

  return { stats, record, clear };
}
