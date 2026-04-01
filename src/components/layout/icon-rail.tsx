"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crosshair,
  MessageSquare,
  Bot,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/chat", label: "对话", icon: MessageSquare },
  { href: "/agents", label: "智能体", icon: Bot },
  { href: "/settings", label: "设置", icon: Settings },
];

export function IconRail() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-16 flex-col items-center border-r border-border bg-marrow/50 py-2 gap-1">
      {/* Logo */}
      <Link
        href="/chat"
        className="flex h-12 w-12 items-center justify-center rounded-sm border border-scrub/30 bg-scrub/10 mb-2 hover:bg-scrub/20 transition-colors"
        title="PharmaAlpha"
      >
        <Crosshair className="h-6 w-6 text-scrub" />
      </Link>

      {/* 新建分析 */}
      <Link
        href="/chat"
        className="flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:text-scrub hover:bg-scrub/10 transition-colors"
        title="新建分析"
      >
        <Plus className="h-6 w-6" />
      </Link>

      <div className="mx-2 my-1 h-px w-8 bg-border" />

      {/* 导航 */}
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/chat"
            ? pathname === "/chat" || pathname.startsWith("/chat/")
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-sm transition-all relative",
              isActive
                ? "text-scrub bg-scrub/10"
                : "text-muted-foreground hover:text-foreground hover:bg-card"
            )}
          >
            <Icon className="h-6 w-6" />
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-scrub rounded-r-full" />
            )}
          </Link>
        );
      })}

      <div className="flex-1" />

      {/* 退出 */}
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        }}
        title="退出登录"
        className="flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:text-vitals-red hover:bg-vitals-red/5 transition-colors mb-1"
      >
        <LogOut className="h-6 w-6" />
      </button>
    </div>
  );
}
