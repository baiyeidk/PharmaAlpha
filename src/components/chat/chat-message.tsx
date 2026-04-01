"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./markdown-renderer";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-pa-cyan/20 bg-pa-cyan/5 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-pa-cyan" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3 text-base leading-relaxed",
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "border border-border/40 bg-card/60 text-foreground"
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{content}</div>
        ) : (
          <div className="break-words">
            {content ? (
              <MarkdownRenderer content={content} />
            ) : isStreaming ? null : (
              <span className="text-muted-foreground italic text-sm">Empty response</span>
            )}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-pa-cyan align-middle" />
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/40 bg-secondary mt-0.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
