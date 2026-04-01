"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

type Condition = "healthy" | "irregular" | "critical" | "flatline";

interface ECGCanvasProps {
  condition?: Condition;
  color?: string;
  speed?: number;
  height?: number;
  className?: string;
  lineWidth?: number;
}

const WAVEFORMS: Record<Condition, number[]> = {
  healthy: [
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,0.02,0.04,0.02,0,-0.02,0,0,
    0,0,0.05,0.1,0,-0.8,1.0,-0.3,0.1,0.15,
    0.1,0.05,0,0,0,0,0.15,0.25,0.3,0.25,
    0.15,0,0,0,0,0,0,0,0,0,
  ],
  irregular: [
    0,0,0,0,0.02,0,0,0,0,0,
    0,0.05,0.1,-0.05,-0.6,0.7,-0.2,0.3,-0.15,0.1,
    0,0,0,0,0,0,0.1,0.2,0.15,0,
    0,0,0,0,0,0.03,-0.03,0.05,0,0,
    0,0,0,0,0,0,0,0,0,0,
  ],
  critical: [
    0.1,-0.1,0.15,-0.12,0.08,-0.05,0.12,-0.08,0.05,-0.1,
    0.15,-0.15,0.2,-0.18,0.1,-0.05,0.08,-0.12,0.18,-0.15,
    0.1,-0.08,0.05,-0.1,0.15,-0.12,0.08,-0.05,0.12,-0.1,
    0.05,-0.08,0.1,-0.15,0.12,-0.1,0.05,-0.05,0.08,-0.08,
    0.1,-0.1,0.05,-0.05,0.08,-0.08,0.12,-0.12,0.05,-0.05,
  ],
  flatline: [
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0.02,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,
  ],
};

export function ECGCanvas({
  condition = "healthy",
  color = "oklch(0.68 0.20 150)",
  speed = 2,
  height = 32,
  className,
  lineWidth = 1.5,
}: ECGCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);
  const bufferRef = useRef<number[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    const waveform = WAVEFORMS[condition];
    const waveLen = waveform.length;

    offsetRef.current = (offsetRef.current + speed * 0.5) % waveLen;

    const buffer = bufferRef.current;
    const totalPoints = Math.ceil(w / 2);

    while (buffer.length < totalPoints + 10) {
      const idx = (buffer.length + Math.floor(offsetRef.current)) % waveLen;
      buffer.push(waveform[idx]);
    }
    while (buffer.length > totalPoints + 10) {
      buffer.shift();
    }

    ctx.clearRect(0, 0, w, h);

    const midY = h / 2;
    const amp = h * 0.4;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const startOffset = offsetRef.current % 1;
    for (let i = 0; i < totalPoints; i++) {
      const x = (i - startOffset) * 2;
      const val = buffer[i] || 0;
      const y = midY - val * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const fadeW = 20;
    const bgColor = getComputedStyle(canvas).getPropertyValue("--ecg-bg") || "white";
    const grad = ctx.createLinearGradient(w - fadeW, 0, w, 0);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, bgColor);
    ctx.fillStyle = grad;
    ctx.fillRect(w - fadeW, 0, fadeW, h);

    const gradL = ctx.createLinearGradient(0, 0, fadeW, 0);
    gradL.addColorStop(0, bgColor);
    gradL.addColorStop(1, "transparent");
    ctx.fillStyle = gradL;
    ctx.fillRect(0, 0, fadeW, h);

    buffer.shift();
    const nextIdx = (Math.floor(offsetRef.current) + buffer.length) % waveLen;
    buffer.push(waveform[nextIdx]);

    animRef.current = requestAnimationFrame(draw);
  }, [condition, color, speed, lineWidth]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full block", className)}
      style={{ height }}
    />
  );
}
