"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Bot,
  Settings,
  LogOut,
  Plus,
  Crosshair,
  Clock,
  BriefcaseBusiness,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useConversations } from "@/hooks/use-conversations";

const navItems = [
  { href: "/chat", label: "OPERATIONS", icon: MessageSquare },
  { href: "/investment-team", label: "INVESTMENT", icon: BriefcaseBusiness },
  { href: "/agents", label: "AGENTS", icon: Bot },
  { href: "/settings", label: "CONFIG", icon: Settings },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export function Sidebar() {
  const pathname = usePathname();
  const { conversations, loading: convsLoading } = useConversations();

  return (
    <div className="flex h-full w-[240px] flex-col border-r border-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-14 items-center gap-3 px-4 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-scrub/30 bg-scrub/10">
          <Crosshair className="h-4 w-4 text-scrub" />
        </div>
        <div className="min-w-0">
          <span className="block font-mono text-sm font-bold uppercase tracking-wider text-foreground">
            PharmaAlpha
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-scrub">
            O.R. Console
          </span>
        </div>
      </div>

      {/* New operation */}
      <div className="px-3 py-3">
        <Link
          href="/chat"
          className="flex w-full items-center gap-2 rounded-sm border border-scrub/30 bg-scrub/5 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-scrub transition-colors hover:bg-scrub/15 hover:border-scrub/50"
        >
          <Plus className="h-3.5 w-3.5" />
          New Operation
        </Link>
      </div>

      <div className="mx-3 h-px bg-border" />

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-3 py-2">
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
              className={cn(
                "flex items-center gap-3 rounded-sm px-3 py-2 font-mono text-xs font-medium uppercase tracking-wider transition-all",
                isActive
                  ? "bg-scrub/10 text-scrub border border-scrub/20"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground border border-transparent"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-scrub animate-pulse-glow" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 h-px bg-border" />

      {/* Case history */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Case History
        </span>
      </div>

      <ScrollArea className="flex-1 px-3 pb-2">
        {convsLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 rounded-sm bg-sidebar-accent/30 animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-4 text-center font-mono text-xs text-muted-foreground">
            No cases on record
          </p>
        ) : (
          <div className="flex flex-col gap-0.5 py-1">
            {conversations.slice(0, 20).map((conv) => {
              const isActive = pathname === `/chat/${conv.id}`;
              return (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className={cn(
                    "group flex items-center gap-2 rounded-sm px-3 py-2 transition-all",
                    isActive
                      ? "bg-scrub/10 text-foreground border border-scrub/20"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground border border-transparent"
                  )}
                >
                  <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {conv.title}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {timeAgo(conv.updatedAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="mx-3 h-px bg-border" />

      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 font-mono text-xs uppercase tracking-wider text-sidebar-foreground/80 hover:text-vitals-red hover:bg-vitals-red/5 rounded-sm"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Scrub Out
        </Button>
      </div>
    </div>
  );
}
