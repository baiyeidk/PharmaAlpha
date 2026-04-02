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
    <div className="flex h-full w-[64px] flex-col items-center py-3 px-2 gap-1">
      {/* Logo */}
      <Link
        href="/chat"
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-scrub/10 mb-2 hover:bg-scrub/20 transition-all hover:scale-105 active:scale-95"
        title="PharmaAlpha"
      >
        <Crosshair className="h-5 w-5 text-scrub" />
      </Link>

      {/* New analysis */}
      <Link
        href="/chat"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:text-scrub hover:bg-black/[0.04] transition-all hover:scale-105 active:scale-95"
        title="新建分析"
      >
        <Plus className="h-5 w-5" />
      </Link>

      <div className="my-1.5 h-px w-8 bg-black/[0.06] rounded-full" />

      {/* Navigation - dock style */}
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-[#f6f5f4]/70 backdrop-blur-xl border border-black/[0.05] p-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
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
                "flex h-10 w-10 items-center justify-center rounded-xl transition-all hover:scale-110 active:scale-95",
                isActive
                  ? "text-scrub bg-scrub/10 shadow-sm"
                  : "text-foreground/50 hover:text-foreground hover:bg-black/[0.04]"
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </div>

      {/* Active dot indicator below dock */}
      <div className="flex gap-1.5 mt-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/chat"
              ? pathname === "/chat" || pathname.startsWith("/chat/")
              : pathname.startsWith(item.href);
          return (
            <div
              key={item.href}
              className={cn(
                "h-1 w-1 rounded-full transition-colors",
                isActive ? "bg-scrub" : "bg-transparent"
              )}
            />
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Logout */}
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        }}
        title="退出登录"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:text-vitals-red hover:bg-vitals-red/5 transition-all hover:scale-105 active:scale-95 mb-1"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  );
}
