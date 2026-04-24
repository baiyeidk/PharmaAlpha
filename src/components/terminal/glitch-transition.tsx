"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function GlitchTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [glitching, setGlitching] = useState(false);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      setGlitching(true);
      const timer = setTimeout(() => setGlitching(false), 200);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <div className={cn("relative", glitching && "glitch-effect")}>
      {children}
      <style jsx>{`
        .glitch-effect {
          animation: glitch 200ms steps(4) forwards;
        }
        @keyframes glitch {
          0% {
            clip-path: inset(20% 0 40% 0);
            transform: translate(-2px, 1px);
            filter: hue-rotate(90deg);
          }
          25% {
            clip-path: inset(60% 0 10% 0);
            transform: translate(2px, -1px);
            filter: hue-rotate(0deg);
          }
          50% {
            clip-path: inset(10% 0 70% 0);
            transform: translate(-1px, 2px);
            filter: hue-rotate(180deg);
          }
          75% {
            clip-path: inset(50% 0 20% 0);
            transform: translate(1px, -2px);
            filter: hue-rotate(0deg);
          }
          100% {
            clip-path: inset(0 0 0 0);
            transform: translate(0);
            filter: none;
          }
        }
      `}</style>
    </div>
  );
}
