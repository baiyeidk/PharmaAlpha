"use client";

import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { ToolEvent } from "@/hooks/use-chat-stream";

interface ToolEventBadgeProps {
  event: ToolEvent;
}

export function ToolEventBadge({ event }: ToolEventBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/[0.04] text-[10px] text-foreground/60 font-mono">
      {event.status === "running" && (
        <Loader2 className="h-2.5 w-2.5 animate-spin text-scrub" />
      )}
      {event.status === "success" && (
        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
      )}
      {event.status === "error" && (
        <XCircle className="h-2.5 w-2.5 text-red-500" />
      )}
      {event.name}
    </span>
  );
}
