"use client";

import {
  FlaskConical,
  TrendingUp,
  CalendarClock,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const indices = [
  {
    name: "S&P Pharma",
    ticker: "XPH",
    value: "2,847.32",
    change: "+1.24%",
    up: true,
    spark: "0,32 8,30 16,35 24,28 32,25 40,27 48,22 56,20 64,23 72,18 80,16 88,14 100,12",
  },
  {
    name: "NBI Biotech",
    ticker: "NBI",
    value: "4,128.91",
    change: "-0.38%",
    up: false,
    spark: "0,18 8,20 16,17 24,22 32,25 40,28 48,24 56,26 64,30 72,28 80,32 88,30 100,33",
  },
  {
    name: "Health Care",
    ticker: "XLV",
    value: "89.42",
    change: "+0.82%",
    up: true,
    spark: "0,30 8,32 16,28 24,30 32,26 40,24 48,22 56,25 64,20 72,18 80,20 88,16 100,15",
  },
  {
    name: "iShares Bio",
    ticker: "IBB",
    value: "132.67",
    change: "+0.45%",
    up: true,
    spark: "0,28 8,26 16,30 24,24 32,28 40,22 48,26 56,20 64,22 72,18 80,20 88,17 100,16",
  },
];

const prompts = [
  {
    icon: FlaskConical,
    label: "Drug pipeline analysis",
    desc: "Phase III trials & catalysts",
    text: "Analyze the current drug pipeline for Pfizer (PFE), including all Phase III trials and upcoming regulatory catalysts for 2026.",
  },
  {
    icon: TrendingUp,
    label: "Stock comparison",
    desc: "Head-to-head investment thesis",
    text: "Compare Johnson & Johnson (JNJ) vs Merck (MRK) as pharmaceutical investment opportunities. Include revenue trends, pipeline strength, and valuation metrics.",
  },
  {
    icon: CalendarClock,
    label: "FDA calendar",
    desc: "PDUFA dates & approvals",
    text: "What are the key FDA PDUFA dates and approval decisions expected this quarter? List by date with potential market impact.",
  },
  {
    icon: BarChart3,
    label: "Sector overview",
    desc: "Investment landscape",
    text: "Give me a comprehensive overview of the pharmaceutical sector's current investment landscape, including top performers, risk factors, and emerging trends.",
  },
];

const headlines = [
  { title: "Eli Lilly GLP-1 agonist revenue exceeds estimates by 23%", time: "2h", up: true },
  { title: "FDA grants fast-track designation to Pfizer mRNA cancer vaccine", time: "5h", up: true },
  { title: "Merck Keytruda faces biosimilar competition earlier than expected", time: "8h", up: false },
  { title: "AbbVie completes $8.7B acquisition, expanding oncology portfolio", time: "1d", up: true },
];

function Sparkline({ points, up }: { points: string; up: boolean }) {
  return (
    <svg viewBox="0 0 100 40" className="h-8 w-full" fill="none" preserveAspectRatio="none">
      <polyline
        points={points}
        stroke={up ? "oklch(0.42 0.16 150)" : "oklch(0.50 0.20 25)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface WelcomeDashboardProps {
  onSendPrompt: (text: string) => void;
  disabled?: boolean;
}

export function WelcomeDashboard({ onSendPrompt, disabled }: WelcomeDashboardProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground">
          PharmaAlpha Intelligence
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pharmaceutical investment analysis powered by AI agents.
        </p>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-pa-green animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Market Indices
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {indices.map((idx) => (
            <div
              key={idx.ticker}
              className="rounded-lg border border-border/30 bg-card/40 p-3"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {idx.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {idx.ticker}
                </span>
              </div>
              <div className="font-mono text-lg font-medium tabular-nums text-foreground">
                {idx.value}
              </div>
              <div
                className={cn(
                  "font-mono text-sm tabular-nums",
                  idx.up ? "text-pa-green" : "text-pa-red"
                )}
              >
                {idx.up ? "▲" : "▽"} {idx.change}
              </div>
              <div className="mt-2">
                <Sparkline points={idx.spark} up={idx.up} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <span className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Quick Analysis
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {prompts.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.label}
                onClick={() => onSendPrompt(p.text)}
                disabled={disabled}
                className="group flex items-start gap-3 rounded-lg border border-border/20 bg-card/20 p-3 text-left transition-all hover:border-pa-cyan/25 hover:bg-card/40 disabled:pointer-events-none disabled:opacity-40"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-pa-cyan group-hover:text-pa-cyan" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-foreground">
                    {p.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Market Pulse
        </span>
        <div className="rounded-lg border border-border/20 bg-card/20 divide-y divide-border/15">
          {headlines.map((h, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
              <div
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  h.up ? "bg-pa-green/50" : "bg-pa-red/50"
                )}
              />
              <p className="min-w-0 flex-1 truncate text-sm text-foreground/80">
                {h.title}
              </p>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {h.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
