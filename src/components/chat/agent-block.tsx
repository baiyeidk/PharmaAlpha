"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolEventBadge } from "./tool-event-badge";
import { AsciiSpinner } from "@/components/terminal/ascii-spinner";
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
    <div className="my-2 font-mono">
      <button
        onClick={() => !isStreaming && setCollapsed(!collapsed)}
        className={cn(
          "flex items-center gap-2 w-full py-1 text-left",
          !isStreaming && "cursor-pointer",
          isStreaming && "cursor-default",
        )}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-term-green-dim transition-transform shrink-0",
            !collapsed && "rotate-90"
          )}
        />
        <span className="text-xs text-term-cyan glow-subtle">[{displayName}]</span>
        {block.task && (
          <span className="text-[10px] text-term-green-dim truncate">{block.task}</span>
        )}
        <span className="ml-auto shrink-0">
          {isStreaming && <AsciiSpinner variant="braille" className="text-[10px]" />}
          {isDone && <span className="text-[10px] text-term-green">[DONE]</span>}
          {isError && <span className="text-[10px] text-term-red">[ERR]</span>}
        </span>
      </button>

      {!collapsed && (
        <div className="ml-5 border-l border-term-green/10 pl-3">
          {block.toolEvents.length > 0 && (
            <div className="space-y-0.5 py-1">
              {block.toolEvents.map((ev) => (
                <ToolEventBadge key={ev.id} event={ev} />
              ))}
            </div>
          )}

          {block.content && (
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
