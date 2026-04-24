"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const PROGRESS_FRAMES = [
  "[█░░░░░░░░░]",
  "[██░░░░░░░░]",
  "[███░░░░░░░]",
  "[████░░░░░░]",
  "[█████░░░░░]",
  "[██████░░░░]",
  "[███████░░░]",
  "[████████░░]",
  "[█████████░]",
  "[██████████]",
];

const MATRIX_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";

function getRandomMatrixChar() {
  return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
}

interface AsciiSpinnerProps {
  variant?: "braille" | "progress" | "matrix";
  text?: string;
  className?: string;
  speed?: number;
}

export function AsciiSpinner({
  variant = "braille",
  text,
  className,
  speed = 100,
}: AsciiSpinnerProps) {
  const [frame, setFrame] = useState(0);
  const [matrixCol, setMatrixCol] = useState(() =>
    Array.from({ length: 6 }, getRandomMatrixChar)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (variant === "matrix") {
        setMatrixCol((prev) => {
          const next = [...prev];
          const idx = Math.floor(Math.random() * next.length);
          next[idx] = getRandomMatrixChar();
          return next;
        });
      }
      setFrame((f) => f + 1);
    }, speed);
    return () => clearInterval(interval);
  }, [variant, speed]);

  if (variant === "matrix") {
    return (
      <span className={cn("font-mono text-term-green glow-subtle inline-flex gap-px", className)}>
        {matrixCol.map((ch, i) => (
          <span key={i} style={{ opacity: 0.3 + (i / matrixCol.length) * 0.7 }}>
            {ch}
          </span>
        ))}
      </span>
    );
  }

  const frames = variant === "progress" ? PROGRESS_FRAMES : BRAILLE_FRAMES;
  const current = frames[frame % frames.length];

  return (
    <span className={cn("font-mono text-term-green glow-subtle", className)}>
      {current}
      {text && <span className="ml-2 text-term-green-dim">{text}</span>}
    </span>
  );
}
