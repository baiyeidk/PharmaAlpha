"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Bot,
  Settings,
  LogOut,
  Plus,
  Activity,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useConversations } from "@/hooks/use-conversations";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
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
    <div className="flex h-full w-[260px] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-3 px-5">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pa-cyan/10 border border-pa-cyan/20">
          <Activity className="h-4 w-4 text-pa-cyan" />
        </div>
        <div className="min-w-0">
          <span className="block text-base font-semibold tracking-tight text-sidebar-foreground truncate">
            PharmaAlpha
          </span>
          <span className="block text-xs font-mono text-pa-cyan uppercase tracking-[0.15em]">
            Terminal v0.1
          </span>
        </div>
      </div>

      <div className="px-3 py-2">
        <Link
          href="/chat"
          className="flex w-full items-center gap-2 rounded-md border border-pa-cyan/15 bg-pa-cyan/5 px-3 py-2 text-sm font-medium text-pa-cyan transition-colors hover:bg-pa-cyan/10 hover:border-pa-cyan/25"
        >
          <Plus className="h-3.5 w-3.5" />
          New Session
        </Link>
      </div>

      <div className="mx-3 h-px bg-sidebar-border" />

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
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-accent text-pa-cyan"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-pa-cyan animate-pulse-glow" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 h-px bg-sidebar-border" />

      <div className="flex items-center gap-2 px-5 pt-3 pb-1">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Recent Sessions
        </span>
      </div>

      <ScrollArea className="flex-1 px-3 pb-2">
        {convsLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-md bg-sidebar-accent/30 animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No sessions yet
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
                    "group flex items-center gap-2 rounded-md px-3 py-2 transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                  )}
                >
                  <MessageSquare className="h-3 w-3 shrink-0 opacity-50" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {conv.title}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {timeAgo(conv.updatedAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="mx-3 h-px bg-sidebar-border" />

      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
