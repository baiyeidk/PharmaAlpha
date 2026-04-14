"use client";

import { Syringe, FileSearch } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";
import { AgentBlock } from "./agent-block";
import { PhaseBlock } from "./phase-block";
import type { MessageBlock } from "@/hooks/use-chat-stream";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  blocks?: MessageBlock[];
}

export function ChatMessage({ role, content, isStreaming, blocks }: ChatMessageProps) {
  const isUser = role === "user";
  const timestamp = new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isUser) {
    return (
      <div className="border-b border-black/[0.04]">
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-vitals-amber/10 mt-0.5">
            <Syringe className="h-3.5 w-3.5 text-vitals-amber" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-vitals-amber">提问</span>
              <span className="text-[10px] text-muted-foreground">{timestamp}</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{content}</p>
          </div>
        </div>
      </div>
    );
  }

  const hasBlocks = blocks && blocks.length > 0;

  return (
    <div className="border-b border-black/[0.04] bg-black/[0.015]">
      <div className="flex items-start gap-3 px-5 py-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-scrub/10 mt-0.5">
          <FileSearch className="h-3.5 w-3.5 text-scrub" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-scrub">诊断报告</span>
            <span className="text-[10px] text-muted-foreground">{timestamp}</span>
            {isStreaming && (
              <span className="text-[10px] text-scrub animate-vitals-blink">● 分析中</span>
            )}
          </div>

          {hasBlocks ? (
            <div className="space-y-0">
              {blocks.map((block) =>
                block.type === "phase" ? (
                  <PhaseBlock key={block.id} block={block} />
                ) : block.type === "sub_agent" ? (
                  <AgentBlock key={block.id} block={block} />
                ) : (
                  <SupervisorBlock key={block.id} block={block} isStreaming={isStreaming} />
                )
              )}
            </div>
          ) : (
            <div className="text-sm text-foreground leading-relaxed break-words">
              {content ? (
                <MarkdownRenderer content={content} />
              ) : isStreaming ? null : (
                <span className="text-muted-foreground italic text-xs">暂无分析结果</span>
              )}
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-scrub align-middle rounded-full" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupervisorBlock({ block, isStreaming }: { block: MessageBlock; isStreaming?: boolean }) {
  if (!block.content && block.status === "streaming") return null;
  if (!block.content) return null;

  const blockStreaming = block.status === "streaming" && isStreaming;

  return (
    <div className="text-sm text-foreground leading-relaxed break-words my-1">
      {block.content && <MarkdownRenderer content={block.content} />}
      {blockStreaming && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-scrub align-middle rounded-full" />
      )}
    </div>
  );
}
