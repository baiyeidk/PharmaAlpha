"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TimingSummary } from "./use-chat-stream";

const STORAGE_KEY = "pharma:timing-stats:v1";
const MAX_SAMPLES = 50;

export interface TimingSample {
  ts: number;
  totalMs: number;
  byPhase: Record<string, number>;
  llmCallCount: number;
  toolCallCount: number;
}

export interface PercentileRow {
  phase: string;
  p50: number;
  p95: number;
  avg: number;
  count: number;
}

export interface TimingStats {
  count: number;
  totalP50: number;
  totalP95: number;
  totalAvg: number;
  rows: PercentileRow[];
  recent: TimingSample[];
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

function summarize(samples: TimingSample[]): TimingStats {
  if (samples.length === 0) {
    return { count: 0, totalP50: 0, totalP95: 0, totalAvg: 0, rows: [], recent: [] };
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

  return {
    count: samples.length,
    totalP50: percentile(totals, 50),
    totalP95: percentile(totals, 95),
    totalAvg: avg(totals),
    rows,
    recent: samples.slice(-10),
  };
}

export function useTimingStats() {
  const [stats, setStats] = useState<TimingStats>(() => summarize(readSamples()));
  const seenKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setStats(summarize(readSamples()));
  }, []);

  const record = useCallback(
    (key: string, summary: TimingSummary) => {
      if (!summary || summary.totalMs <= 0) return;
      if (seenKeysRef.current.has(key)) return;
      seenKeysRef.current.add(key);

      const sample: TimingSample = {
        ts: Date.now(),
        totalMs: summary.totalMs,
        byPhase: { ...summary.byPhase },
        llmCallCount: summary.llmCalls.length,
        toolCallCount: summary.toolCalls.length,
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
