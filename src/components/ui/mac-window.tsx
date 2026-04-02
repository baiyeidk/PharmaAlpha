"use client";

import { cn } from "@/lib/utils";

interface MacWindowProps {
  title?: string;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: "default" | "subtle";
}

export function MacWindow({
  title,
  titleRight,
  children,
  className,
  contentClassName,
  variant = "default",
}: MacWindowProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl overflow-hidden",
        variant === "default"
          ? "bg-[#f6f5f4]/80 backdrop-blur-2xl shadow-[0_1px_4px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] border border-black/[0.05]"
          : "bg-[#f6f5f4]/60 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.04)] border border-black/[0.04]",
        className,
      )}
    >
      {/* macOS title bar */}
      <div className="flex h-10 items-center shrink-0 px-4 gap-3 border-b border-black/[0.05] bg-[#eceae8]/50">
        {/* Traffic lights */}
        <div className="flex items-center gap-[7px] shrink-0">
          <div className="h-3 w-3 rounded-full bg-[#EC6A5E] border border-[#D1503F]/40" />
          <div className="h-3 w-3 rounded-full bg-[#F4BF4F] border border-[#D49E28]/40" />
          <div className="h-3 w-3 rounded-full bg-[#61C554] border border-[#4CA93B]/40" />
        </div>

        {title && (
          <span className="text-[13px] font-medium text-foreground/70 truncate">
            {title}
          </span>
        )}

        {titleRight && (
          <div className="ml-auto flex items-center shrink-0">
            {titleRight}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-h-0 overflow-hidden", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
