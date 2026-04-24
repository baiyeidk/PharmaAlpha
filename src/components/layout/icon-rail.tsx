"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Bot,
  BriefcaseBusiness,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare, code: "01" },
  { href: "/investment-team", label: "Investment", icon: BriefcaseBusiness, code: "02" },
  { href: "/agents", label: "Agents", icon: Bot, code: "03" },
  { href: "/settings", label: "Settings", icon: Settings, code: "04" },
];

export function IconRail() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[60px] flex-col items-center gap-1 border-r border-[var(--nf-border-invisible)] bg-[var(--nf-bg-surface)] px-2 py-3">
      <Link
        href="/chat"
        className="group relative mb-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-[4px] border border-[var(--nf-border-invisible)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--nf-border-visible)] hover:shadow-[var(--nf-glow-sm)]"
        title="PharmaAlpha"
      >
        <Image
          src="/logo.png"
          alt="PA"
          width={32}
          height={32}
          priority
          className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
        />
      </Link>

      <Link
        href="/chat"
        className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[var(--nf-border-invisible)] text-[var(--nf-text-tertiary)] transition-[border-color,color,box-shadow] duration-200 hover:border-[var(--nf-accent)] hover:text-[var(--nf-accent)] hover:shadow-[var(--nf-glow-sm)]"
        title="New Analysis"
      >
        <Plus className="h-4 w-4" />
      </Link>

      <div className="my-2 h-px w-6 bg-[var(--nf-border-invisible)]" />

      <nav className="flex flex-col items-center gap-1">
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
                "group relative flex h-10 w-10 items-center justify-center rounded-[4px] border transition-[border-color,color,box-shadow,background-color] duration-200",
                isActive
                  ? "border-[rgba(255,109,31,0.4)] bg-[var(--nf-accent-muted)] text-[var(--nf-accent)] shadow-[var(--nf-glow-md)]"
                  : "border-transparent text-[var(--nf-text-tertiary)] hover:border-[var(--nf-border-visible)] hover:text-[var(--nf-text-hover)]"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {isActive && (
                <span className="absolute -left-[7px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[var(--nf-accent)] shadow-[0_0_4px_rgba(255,109,31,0.7)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="mb-2 flex flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/chat"
              ? pathname === "/chat" || pathname.startsWith("/chat/")
              : pathname.startsWith(item.href);
          return (
            <span
              key={item.href}
              aria-hidden
              className={cn(
                "font-mono text-[9px] font-semibold tracking-[0.1em] transition-colors",
                isActive ? "text-[var(--nf-accent)]" : "text-[var(--nf-text-disabled)]"
              )}
            >
              {item.code}
            </span>
          );
        })}
      </div>

      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        }}
        title="Logout"
        className="mb-1 flex h-9 w-9 items-center justify-center rounded-[4px] border border-[var(--nf-border-invisible)] text-[var(--nf-text-tertiary)] transition-[border-color,color,background-color] duration-200 hover:border-[rgba(217,106,94,0.4)] hover:bg-[rgba(217,106,94,0.06)] hover:text-[var(--nf-danger)]"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </aside>
  );
}
