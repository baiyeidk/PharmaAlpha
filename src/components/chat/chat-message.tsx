"use client";

import { MarkdownRenderer } from "./markdown-renderer";
import { AgentBlock } from "./agent-block";
import { PhaseBlock } from "./phase-block";
import { ToolEventBadge } from "./tool-event-badge";
import { TimingPanel } from "./timing-panel";
import { ErrorBlock } from "./error-block";
import { AsciiDivider } from "@/components/terminal/ascii-divider";
import type {
  MessageBlock,
  TimingSummary,
  TokenUsageSummary,
  MessageError,
  AgentLogLine,
} from "@/hooks/use-chat-stream";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  blocks?: MessageBlock[];
  timingSummary?: TimingSummary;
  tokenSummary?: TokenUsageSummary;
  errors?: MessageError[];
  agentLogs?: AgentLogLine[];
}

export function ChatMessage({
  role,
  content,
  isStreaming,
  blocks,
  timingSummary,
  tokenSummary,
  errors,
  agentLogs,
}: ChatMessageProps) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="px-4 py-3 font-mono">
        <div className="flex items-start gap-2">
          <span className="text-term-amber text-sm shrink-0 glow-subtle">$</span>
          <p className="text-sm text-term-amber leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </p>
        </div>
      </div>
    );
  }

  const hasBlocks = blocks && blocks.length > 0;

  return (
    <div className="px-4 py-3">
      {isStreaming && !hasBlocks && !content && (
        <div className="font-mono text-xs text-term-green-dim">
          <span className="text-term-green cursor-blink">█</span>
        </div>
      )}

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
      ) : content ? (
        <div className="text-sm text-foreground leading-relaxed break-words font-mono">
          <MarkdownRenderer content={content} />
          {isStreaming && (
            <span className="text-term-green cursor-blink">█</span>
          )}
        </div>
      ) : null}

      {errors && errors.length > 0 && (
        <ErrorBlock errors={errors} logs={agentLogs} />
      )}

      {/* Even when there are no fatal errors, surface error/warn-level stderr
          lines so silent failures don't go unnoticed. */}
      {(!errors || errors.length === 0) && agentLogs && agentLogs.some(
        (l) => l.level === "error" || l.level === "warn",
      ) && <ErrorBlock errors={[]} logs={agentLogs} />}

      {timingSummary && (timingSummary.totalMs > 0 || timingSummary.llmCalls.length > 0) && (
        <TimingPanel summary={timingSummary} tokenSummary={tokenSummary} />
      )}

      <AsciiDivider variant="dots" className="mt-3 opacity-30" />
    </div>
  );
}

function SupervisorBlock({ block, isStreaming }: { block: MessageBlock; isStreaming?: boolean }) {
  const hasTools = block.toolEvents.length > 0;
  const hasContent = !!block.content;
  const blockStreaming = block.status === "streaming" && isStreaming;

  if (!hasContent && !hasTools && block.status === "streaming") return null;
  if (!hasContent && !hasTools) return null;

  return (
    <div className="text-sm text-foreground leading-relaxed break-words my-1 font-mono">
      {hasTools && (
        <div className="space-y-0.5 mb-2">
          {block.toolEvents.map((ev) => (
            <ToolEventBadge key={ev.id} event={ev} />
          ))}
        </div>
      )}
      {hasContent && <MarkdownRenderer content={block.content} />}
      {blockStreaming && (
        <span className="text-term-green cursor-blink">█</span>
      )}
    </div>
  );
}
