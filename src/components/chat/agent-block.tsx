"use client";

import { useState } from "react";
import { ChevronRight, Bot, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolEventBadge } from "./tool-event-badge";
import { getAgentDisplayName } from "@/hooks/use-chat-stream";
import type { MessageBlock } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

interface AgentBlockProps {
  block: MessageBlock;
}

export function AgentBlock({ block }: AgentBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const displayName = block.agentName ? getAgentDisplayName(block.agentName) : "子代理";
  const isStreaming = block.status === "streaming";
  const isDone = block.status === "done";
  const isError = block.status === "error";

  return (
    <div className="rounded-lg border border-black/[0.06] bg-white/50 overflow-hidden my-2">
      {/* Header */}
      <button
        onClick={() => !isStreaming && setCollapsed(!collapsed)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 text-left transition-colors",
          !isStreaming && "hover:bg-black/[0.02] cursor-pointer",
          isStreaming && "cursor-default",
        )}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-foreground/40 transition-transform shrink-0",
            !collapsed && "rotate-90"
          )}
        />
        <Bot className="h-3.5 w-3.5 text-scrub shrink-0" />
        <span className="text-[11px] font-semibold text-scrub">{displayName}</span>
        {block.task && (
          <span className="text-[10px] text-foreground/40 truncate">{block.task}</span>
        )}
        <span className="ml-auto shrink-0">
          {isStreaming && <Loader2 className="h-3 w-3 animate-spin text-scrub/60" />}
          {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-500/70" />}
          {isError && <AlertCircle className="h-3 w-3 text-red-500/70" />}
        </span>
      </button>

      {/* Tool events bar */}
      {block.toolEvents.length > 0 && !collapsed && (
        <div className="flex flex-wrap gap-1 px-3 pb-1.5">
          {block.toolEvents.map((ev) => (
            <ToolEventBadge key={ev.id} event={ev} />
          ))}
        </div>
      )}

      {/* Content */}
      {!collapsed && block.content && (
        <div className="px-3 pb-3 text-sm text-foreground leading-relaxed border-t border-black/[0.04] pt-2">
          <MarkdownRenderer content={block.content} />
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-scrub align-middle rounded-full" />
          )}
        </div>
      )}
    </div>
  );
}
