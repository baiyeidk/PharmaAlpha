import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg" | "xl";

interface LogoProps {
  size?: LogoSize;
  showWordmark?: boolean;
  tagline?: boolean;
  className?: string;
  glow?: boolean;
}

const MARK_PX: Record<LogoSize, number> = {
  sm: 28,
  md: 40,
  lg: 64,
  xl: 112,
};

const WORDMARK: Record<LogoSize, string> = {
  sm: "text-[13px]",
  md: "text-[15px]",
  lg: "text-[20px]",
  xl: "text-[28px]",
};

export function Logo({
  size = "md",
  showWordmark = false,
  tagline = false,
  className,
  glow = false,
}: LogoProps) {
  const px = MARK_PX[size];

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-[4px]",
          glow && "shadow-[0_0_18px_rgba(255,109,31,0.18),0_0_40px_rgba(255,109,31,0.08)]"
        )}
        style={{ width: px, height: px }}
      >
        <Image
          src="/logo.png"
          alt="PharmaAlpha"
          width={px}
          height={px}
          priority
          className="h-full w-full object-cover"
        />
      </div>
      {showWordmark && (
        <div className="flex flex-col justify-center leading-none">
          <span
            className={cn(
              "font-mono font-semibold nf-text-primary tracking-[0.08em]",
              WORDMARK[size],
              glow && "glow-subtle"
            )}
          >
            PharmaAlpha
          </span>
          {tagline && (
            <span className="mt-1.5 nf-nano nf-text-accent tracking-[0.24em]">
              DATA · INSIGHT · DECISION
            </span>
          )}
        </div>
      )}
    </div>
  );
}
