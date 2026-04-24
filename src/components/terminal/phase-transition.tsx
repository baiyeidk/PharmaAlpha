"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface PhaseTransitionProps {
  label: string;
  className?: string;
}

export function PhaseTransition({ label, className }: PhaseTransitionProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(100));
    return () => cancelAnimationFrame(raf);
  }, []);

  const line = "═".repeat(20);

  return (
    <div
      className={cn("font-mono text-xs text-term-amber glow-subtle overflow-hidden", className)}
      style={{
        clipPath: `inset(0 ${100 - width}% 0 0)`,
        transition: "clip-path 400ms ease-out",
      }}
    >
      {line} {label.toUpperCase()} {line}
    </div>
  );
}
