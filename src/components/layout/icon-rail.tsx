"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  BriefcaseBusiness,
  Crosshair,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/investment-team", label: "Investment", icon: BriefcaseBusiness },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function IconRail() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-[64px] flex-col items-center gap-1 px-2 py-3">
      <Link
        href="/chat"
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-scrub/10 transition-all hover:scale-105 hover:bg-scrub/20 active:scale-95"
        title="PharmaAlpha"
      >
        <Crosshair className="h-5 w-5 text-scrub" />
      </Link>

      <Link
        href="/chat"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:scale-105 hover:bg-black/[0.04] hover:text-scrub active:scale-95"
        title="New Analysis"
      >
        <Plus className="h-5 w-5" />
      </Link>

      <div className="my-1.5 h-px w-8 rounded-full bg-black/[0.06]" />

      <div className="flex flex-col items-center gap-1 rounded-2xl border border-black/[0.05] bg-[#f6f5f4]/70 p-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] backdrop-blur-xl">
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
                  ? "bg-scrub/10 text-scrub shadow-sm"
                  : "text-foreground/50 hover:bg-black/[0.04] hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </div>

      <div className="mt-1 flex gap-1.5">
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

      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        }}
        title="Logout"
        className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:scale-105 hover:bg-vitals-red/5 hover:text-vitals-red active:scale-95"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  );
}
