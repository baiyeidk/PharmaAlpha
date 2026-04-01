"use client";

import { Syringe, FileSearch } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";
  const timestamp = new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isUser) {
    return (
      <div className="border-b border-neutral-200 bg-white">
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-vitals-amber/10 mt-0.5">
            <Syringe className="h-5 w-5 text-vitals-amber" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold tracking-widest text-vitals-amber">
                提问
              </span>
              <span className="font-mono text-sm text-neutral-600">{timestamp}</span>
            </div>
            <p className="text-lg text-neutral-900 whitespace-pre-wrap break-words">{content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-neutral-200 bg-neutral-50">
      <div className="flex items-start gap-3 px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-scrub/10 mt-0.5">
          <FileSearch className="h-5 w-5 text-scrub" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-bold tracking-widest text-scrub">
              诊断报告
            </span>
            <span className="font-mono text-sm text-neutral-600">{timestamp}</span>
            {isStreaming && (
              <span className="font-mono text-sm text-scrub animate-vitals-blink">● 分析中</span>
            )}
          </div>
          <div className="text-lg text-neutral-900 break-words">
            {content ? (
              <MarkdownRenderer content={content} />
            ) : isStreaming ? null : (
              <span className="text-neutral-600 italic text-base">暂无分析结果</span>
            )}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-scrub align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
