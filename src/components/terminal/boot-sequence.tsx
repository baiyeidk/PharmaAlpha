"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_LINES = [
  { text: "PharmaAlpha Terminal v1.0", delay: 0 },
  { text: "────────────────────────────────", delay: 150 },
  { text: "> Initializing PEC Agent...", delay: 300 },
  { text: "> Loading memory modules.......... [OK]", delay: 600 },
  { text: "> Connecting RAG pipeline......... [OK]", delay: 900 },
  { text: "> Loading tool registry........... [OK]", delay: 1200 },
  { text: "> Context builder ready........... [OK]", delay: 1500 },
  { text: "", delay: 1700 },
  { text: "System READY. Awaiting input.", delay: 1800 },
];

interface BootSequenceProps {
  lines?: Array<{ text: string; delay: number }>;
  onComplete?: () => void;
  className?: string;
}

export function BootSequence({
  lines = DEFAULT_LINES,
  onComplete,
  className,
}: BootSequenceProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach((line, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleCount(i + 1);
          if (i === lines.length - 1) {
            setTimeout(() => {
              setDone(true);
              onComplete?.();
            }, 600);
          }
        }, line.delay)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [lines, onComplete]);

  const skip = useCallback(() => {
    setVisibleCount(lines.length);
    setDone(true);
    onComplete?.();
  }, [lines.length, onComplete]);

  return (
    <div
      className={cn("font-mono text-sm space-y-0.5", className)}
      onClick={skip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && skip()}
    >
      {lines.slice(0, visibleCount).map((line, i) => (
        <div
          key={i}
          className={cn(
            "whitespace-pre",
            line.text.includes("[OK]")
              ? "text-term-green"
              : line.text === "" 
                ? "h-3"
                : line.text.startsWith(">")
                  ? "text-foreground/70"
                  : i === lines.length - 1
                    ? "text-term-amber glow-normal"
                    : "text-foreground glow-subtle",
          )}
        >
          {line.text}
        </div>
      ))}
      {!done && visibleCount > 0 && (
        <span className="text-term-green cursor-blink">█</span>
      )}
    </div>
  );
}
