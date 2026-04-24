"use client";

import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { ToolEventBadge } from "./tool-event-badge";
import { MarkdownRenderer } from "./markdown-renderer";
import { PhaseTransition } from "@/components/terminal/phase-transition";
import { AsciiSpinner } from "@/components/terminal/ascii-spinner";
import { getPhaseDisplayName } from "@/hooks/use-chat-stream";
import type { MessageBlock } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

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

  const displayName = getPhaseDisplayName(phase, block.round);
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const hasToolEvents = block.toolEvents.length > 0;
  const hasPlanSteps = block.planSteps && block.planSteps.length > 0;
  const hasCheckResult = !!block.checkResult;
  const hasContent = !!block.content;
  const hasBody = hasToolEvents || hasPlanSteps || hasCheckResult || hasContent;

  return (
    <div className="my-2 font-mono">
      <PhaseTransition label={displayName} />

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full py-1 text-left cursor-pointer group"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-term-green-dim transition-transform shrink-0",
            !collapsed && "rotate-90"
          )}
        />
        <span className="text-[10px] text-term-green-dim">[{timestamp}]</span>
        <span className="text-xs text-term-amber glow-subtle">{displayName}</span>

        {hasToolEvents && collapsed && (
          <span className="text-[10px] text-term-green-dim">
            {block.toolEvents.length} tools
          </span>
        )}

        <span className="ml-auto shrink-0">
          {isStreaming && <AsciiSpinner variant="braille" className="text-[10px]" />}
          {isDone && !hasCheckResult && (
            <span className="text-[10px] text-term-green">[DONE]</span>
          )}
          {hasCheckResult && block.checkResult!.passed && (
            <span className="text-[10px] text-term-green">[PASS]</span>
          )}
          {hasCheckResult && !block.checkResult!.passed && (
            <span className="text-[10px] text-term-amber">[RETRY]</span>
          )}
        </span>
      </button>

      {!collapsed && hasBody && (
        <div className="ml-5 border-l border-term-green/10 pl-3 space-y-1">
          {hasPlanSteps && (
            <div className="py-1">
              {block.planSteps!.map((step, i) => (
                <div key={(step.id as string) || i} className="text-xs text-foreground/80">
                  <span className="text-term-green-dim">{i + 1}.</span>{" "}
                  {(step.description as string) || JSON.stringify(step)}
                </div>
              ))}
            </div>
          )}

          {hasToolEvents && (
            <div className="space-y-0.5 py-1">
              {block.toolEvents.map((ev) => (
                <ToolEventBadge key={ev.id} event={ev} />
              ))}
            </div>
          )}

          {hasCheckResult && (
            <div className="py-1 text-xs">
              <span className={block.checkResult!.passed ? "text-term-green" : "text-term-amber"}>
                {block.checkResult!.summary}
              </span>
              {block.checkResult!.gaps && block.checkResult!.gaps.length > 0 && (
                <div className="mt-1 text-term-green-dim">
                  {block.checkResult!.gaps.map((g, i) => (
                    <div key={i}>- {g}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasContent && (
            <div className="py-1 text-sm text-foreground leading-relaxed">
              <MarkdownRenderer content={block.content} />
              {isStreaming && (
                <span className="text-term-green cursor-blink">█</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
