"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight, ListChecks, Play, ShieldCheck,
  Loader2, CheckCircle2, XCircle,
} from "lucide-react";
import { ToolEventBadge } from "./tool-event-badge";
import { MarkdownRenderer } from "./markdown-renderer";
import { getPhaseDisplayName } from "@/hooks/use-chat-stream";
import type { MessageBlock } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

const PHASE_ICONS: Record<string, typeof ListChecks> = {
  plan: ListChecks,
  execute: Play,
  check: ShieldCheck,
};

const PHASE_COLORS: Record<string, string> = {
  plan: "text-blue-600",
  execute: "text-amber-600",
  check: "text-violet-600",
};

interface PhaseBlockProps {
  block: MessageBlock;
}

export function PhaseBlock({ block }: PhaseBlockProps) {
  const phase = block.phase || "unknown";
  const isDone = block.status === "done";
  const isStreaming = block.status === "streaming";

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (isDone && phase !== "check") {
      setCollapsed(true);
    }
  }, [isDone, phase]);

  const Icon = PHASE_ICONS[phase] || ListChecks;
  const color = PHASE_COLORS[phase] || "text-scrub";
  const displayName = getPhaseDisplayName(phase, block.round);

  const hasToolEvents = block.toolEvents.length > 0;
  const hasPlanSteps = block.planSteps && block.planSteps.length > 0;
  const hasCheckResult = !!block.checkResult;
  const hasContent = !!block.content;
  const hasBody = hasToolEvents || hasPlanSteps || hasCheckResult || hasContent;

  return (
    <div className="rounded-lg border border-black/[0.06] bg-white/50 overflow-hidden my-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-black/[0.02] cursor-pointer transition-colors"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-foreground/40 transition-transform shrink-0",
            !collapsed && "rotate-90"
          )}
        />
        <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
        <span className={cn("text-[11px] font-semibold", color)}>{displayName}</span>

        {hasToolEvents && collapsed && (
          <span className="text-[10px] text-foreground/40">
            {block.toolEvents.length} 个工具调用
          </span>
        )}

        <span className="ml-auto shrink-0">
          {isStreaming && <Loader2 className="h-3 w-3 animate-spin text-foreground/40" />}
          {isDone && !hasCheckResult && <CheckCircle2 className="h-3 w-3 text-emerald-500/70" />}
          {hasCheckResult && block.checkResult!.passed && <CheckCircle2 className="h-3 w-3 text-emerald-500/70" />}
          {hasCheckResult && !block.checkResult!.passed && <XCircle className="h-3 w-3 text-amber-500/70" />}
        </span>
      </button>

      {!collapsed && hasBody && (
        <div className="border-t border-black/[0.04]">
          {hasPlanSteps && (
            <div className="px-3 py-2">
              <ol className="list-decimal list-inside text-xs text-foreground/70 space-y-1">
                {block.planSteps!.map((step, i) => (
                  <li key={step.id as string || i}>
                    {step.description as string || JSON.stringify(step)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {hasToolEvents && (
            <div className="flex flex-wrap gap-1 px-3 py-1.5">
              {block.toolEvents.map((ev) => (
                <ToolEventBadge key={ev.id} event={ev} />
              ))}
            </div>
          )}

          {hasCheckResult && (
            <div className="px-3 py-2 text-xs">
              <span className={block.checkResult!.passed ? "text-emerald-600" : "text-amber-600"}>
                {block.checkResult!.summary}
              </span>
              {block.checkResult!.gaps && block.checkResult!.gaps.length > 0 && (
                <ul className="mt-1 list-disc list-inside text-foreground/60">
                  {block.checkResult!.gaps.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              )}
            </div>
          )}

          {hasContent && (
            <div className="px-3 pb-3 pt-1 text-sm text-foreground leading-relaxed">
              <MarkdownRenderer content={block.content} />
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-scrub align-middle rounded-full" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
