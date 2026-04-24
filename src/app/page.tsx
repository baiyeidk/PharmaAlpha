"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  ArrowRight,
  Cpu,
  Database,
  Terminal,
  UserPlus2,
  Workflow,
} from "lucide-react";
import { useTypewriter } from "@/hooks/use-typewriter";

const CAPABILITIES = [
  {
    code: "01",
    icon: Cpu,
    title: "PEC Agent Loop",
    body: "Plan → Execute → Check → Synthesize. Deterministic reasoning traces across every query.",
  },
  {
    code: "02",
    icon: Database,
    title: "Memory & RAG",
    body: "Long-term context merged with vectorized clinical and filings corpus.",
  },
  {
    code: "03",
    icon: Activity,
    title: "Live Market Feed",
    body: "Quotes, pipelines, approvals and research ingested as structured events.",
  },
  {
    code: "04",
    icon: Workflow,
    title: "Infinite Canvas",
    body: "Directed-acyclic analysis boards. Drag, branch, compose.",
  },
];

const CONSOLE_LINES = [
  "> pharma-alpha --boot",
  "  link.local             [ OK ]",
  "  agents.registry        [ 04 ready ]",
  "  memory.vector          [ online ]",
  "  market.ingest          [ streaming ]",
];

export default function LandingPage() {
  const { displayed: l0, isDone: d0 } = useTypewriter(CONSOLE_LINES[0], { speed: 22, startDelay: 200 });
  const { displayed: l1, isDone: d1 } = useTypewriter(CONSOLE_LINES[1], { speed: 22, startDelay: 120, enabled: d0 });
  const { displayed: l2, isDone: d2 } = useTypewriter(CONSOLE_LINES[2], { speed: 22, startDelay: 120, enabled: d1 });
  const { displayed: l3, isDone: d3 } = useTypewriter(CONSOLE_LINES[3], { speed: 22, startDelay: 120, enabled: d2 });
  const { displayed: l4, isDone: d4 } = useTypewriter(CONSOLE_LINES[4], { speed: 22, startDelay: 120, enabled: d3 });

  const bootLines = [
    { text: l0, prev: true },
    { text: l1, prev: d0 },
    { text: l2, prev: d1 },
    { text: l3, prev: d2 },
    { text: l4, prev: d3 },
  ];

  return (
    <div className="nf-page nf-scroll h-full overflow-y-auto p-6 pb-16">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nf-border-invisible)] pb-5">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="nf-nano">SYS / 00</span>
              <span className="h-px w-10 bg-[var(--nf-border-visible)]" />
              <span className="nf-nano nf-text-accent">TERMINAL_READY</span>
            </div>
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="PharmaAlpha"
                width={36}
                height={36}
                priority
                className="h-9 w-9 rounded-[4px] border border-[var(--nf-border-invisible)] object-cover"
              />
              <h1 className="nf-h1">PharmaAlpha</h1>
            </div>
            <p className="nf-sub max-w-2xl">
              Retro-terminal AI analyst for pharmaceutical intelligence &mdash; quotes, filings, clinical pipelines, and investment reasoning in a single console. Calm, technical, deterministic.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/register" className="nf-btn">
              <UserPlus2 className="h-3.5 w-3.5" />
              Register
            </Link>
            <Link href="/login" className="nf-btn nf-btn-primary">
              <ArrowRight className="h-3.5 w-3.5" />
              Authenticate
            </Link>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <StatCell label="Agents" value="04" tone="accent" />
          <StatCell label="Modules" value="12" />
          <StatCell label="Uplink" value="STABLE" mono />
        </section>

        <section className="nf-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 nf-text-accent" />
              <h2 className="nf-h2">Capabilities</h2>
              <span className="nf-nano nf-mono nf-text-tertiary">04 modules</span>
            </div>
            <span className="nf-nano">02</span>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <li
                  key={cap.code}
                  className="nf-card nf-card-hover flex flex-col gap-3 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="nf-nano nf-text-accent2">MOD · {cap.code}</span>
                    <Icon className="h-3.5 w-3.5 nf-text-accent" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-[13px] nf-text-primary tracking-[0.02em]">
                      {cap.title}
                    </div>
                    <p className="mt-1.5 text-[11.5px] nf-text-secondary leading-relaxed">
                      {cap.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="nf-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 nf-text-accent" />
              <h2 className="nf-h2">Boot Log</h2>
              <span className="nf-nano nf-mono nf-text-tertiary">stdout · live</span>
            </div>
            <span className="nf-nano">03</span>
          </div>
          <pre className="nf-mono nf-text-input whitespace-pre-wrap text-[12px] leading-[1.85]">
            {bootLines.map((line, i) => {
              const isLast = i === bootLines.length - 1;
              return (
                <div key={i} className="tabular-nums">
                  <span className={line.prev ? "nf-text-accent" : "nf-text-disabled"}>
                    {line.text}
                  </span>
                  {isLast && !d4 && (
                    <span className="cursor-blink nf-text-accent">▊</span>
                  )}
                </div>
              );
            })}
          </pre>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--nf-border-invisible)] pt-4 nf-nano">
          <span>© 2026 · PHARMAALPHA</span>
          <span className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[var(--nf-success)]" />
              SECURE · TLS 1.3
            </span>
            <span>BUILD · v1.0.0</span>
            <span>CHANNEL · 01</span>
          </span>
        </footer>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone?: "accent";
  mono?: boolean;
}) {
  const valueClass = tone === "accent" ? "nf-text-accent" : "nf-text-primary";
  return (
    <div className="nf-panel p-4">
      <div className="nf-nano">{label}</div>
      <div
        className={`mt-2 font-mono tracking-[0.04em] ${valueClass} ${mono ? "text-[16px]" : "text-[22px]"}`}
      >
        {value}
      </div>
    </div>
  );
}
