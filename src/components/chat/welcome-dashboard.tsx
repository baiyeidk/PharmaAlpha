"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronRight, Sparkles, Terminal } from "lucide-react";
import { BootSequence } from "@/components/terminal/boot-sequence";

const commands = [
  {
    code: "01",
    label: "管线深度解剖",
    text: "深度分析恒瑞医药（600276）的在研药物管线，包括所有 III 期临床试验、成功概率、2026 年即将到来的审批节点和竞争格局。",
  },
  {
    code: "02",
    label: "企业健康对比",
    text: "横向对比药明康德（603259）和泰格医药（300347）：营收趋势、管线能力、估值水平、现金流健康度、客户集中度风险及整体投资逻辑。",
  },
  {
    code: "03",
    label: "财报病理分析",
    text: "对迈瑞医疗（300760）进行深度财报分析：最新季度收入结构、利润率趋势、研发投入效率、负债水平、现金流质量以及海外业务占比。",
  },
  {
    code: "04",
    label: "行业全景解剖",
    text: "给出中国医药行业全景分析：板块涨跌龙虎榜、集采政策影响、创新药出海进展、并购动态、资金流向及政策风向。",
  },
];

interface WelcomeDashboardProps {
  onSendPrompt: (text: string) => void;
  disabled?: boolean;
}

export function WelcomeDashboard({ onSendPrompt, disabled }: WelcomeDashboardProps) {
  const [bootDone, setBootDone] = useState(false);

  return (
    <div className="nf-page nf-scroll h-full overflow-y-auto p-6 pb-16">
      <div className="mx-auto flex max-w-[900px] flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nf-border-invisible)] pb-5">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="nf-nano">SYS / CHAT</span>
              <span className="h-px w-10 bg-[var(--nf-border-visible)]" />
              <span className="nf-nano nf-text-accent">SESSION_READY</span>
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
              <h1 className="nf-h1">PharmaAlpha Console</h1>
            </div>
            <p className="nf-sub max-w-2xl">
              AI-powered pharmaceutical investment analysis. Type a command below, or select a preset to seed the session.
            </p>
          </div>
          <span className="nf-nano nf-text-tertiary">awaiting input</span>
        </header>

        {!bootDone ? (
          <section className="nf-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 nf-text-accent" />
                <h2 className="nf-h2">Boot Sequence</h2>
                <span className="nf-nano nf-mono nf-text-tertiary">stdout · live</span>
              </div>
              <span className="nf-nano">01</span>
            </div>
            <BootSequence onComplete={() => setBootDone(true)} />
          </section>
        ) : (
          <section className="nf-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 nf-text-accent" />
                <h2 className="nf-h2">Quick Commands</h2>
                <span className="nf-nano nf-mono nf-text-tertiary">{commands.length} presets</span>
              </div>
              <span className="nf-nano">02</span>
            </div>

            <ul className="grid gap-2 sm:grid-cols-2">
              {commands.map((cmd) => (
                <li key={cmd.code}>
                  <button
                    onClick={() => onSendPrompt(cmd.text)}
                    disabled={disabled}
                    className="nf-card nf-card-hover group flex w-full flex-col items-start gap-2 p-4 text-left disabled:pointer-events-none disabled:opacity-30"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="nf-nano nf-text-accent2">CMD · {cmd.code}</span>
                      <ChevronRight className="h-3 w-3 nf-text-tertiary transition-colors group-hover:text-[var(--nf-accent)]" />
                    </div>
                    <span className="text-[13px] nf-text-primary tracking-[0.02em]">
                      {cmd.label}
                    </span>
                    <p className="line-clamp-2 text-[11.5px] nf-text-secondary leading-relaxed">
                      {cmd.text}
                    </p>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-[var(--nf-border-invisible)] pt-3 text-center nf-nano nf-text-tertiary">
              type a command in the console below, or select a preset above
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
