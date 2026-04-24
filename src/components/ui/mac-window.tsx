"use client";

import { cn } from "@/lib/utils";

interface MacWindowProps {
  title?: string;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: "default" | "subtle";
  style?: React.CSSProperties;
}

/**
 * Industrial terminal window chrome.
 * Three restrained status dots (accent, accent-2, text-tertiary) replace
 * the classic macOS traffic lights to stay inside the Nexus Dark FUI palette.
 */
export function MacWindow({
  title,
  titleRight,
  children,
  className,
  contentClassName,
  variant = "default",
  style,
}: MacWindowProps) {
  return (
    <div
      style={style}
      className={cn(
        "flex flex-col overflow-clip rounded-[6px] border",
        variant === "default"
          ? "border-[var(--nf-border-invisible)] bg-[var(--nf-bg-surface-alpha)] shadow-[0_1px_4px_rgba(0,0,0,0.3),0_8px_32px_rgba(0,0,0,0.35)]"
          : "border-[var(--nf-border-invisible)] bg-[rgba(14,14,16,0.6)] shadow-[0_1px_3px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-[var(--nf-border-invisible)] bg-[var(--nf-bg-elevated)] px-3">
        <div className="flex shrink-0 items-center gap-[6px]">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-[var(--nf-accent)] shadow-[0_0_4px_rgba(255,109,31,0.55)]"
          />
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-[var(--nf-accent2)]"
          />
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-[var(--nf-text-disabled)]"
          />
        </div>

        {title && (
          <span className="truncate font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--nf-text-tertiary)]">
            {title}
          </span>
        )}

        {titleRight && (
          <div className="ml-auto flex shrink-0 items-center">{titleRight}</div>
        )}
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
