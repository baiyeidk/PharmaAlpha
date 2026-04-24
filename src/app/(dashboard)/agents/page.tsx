"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Power, RefreshCcw, Search, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  enabled: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
}

type Filter = "all" | "active" | "disabled";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = () => {
    setLoading(true);
    fetch("/api/agents")
      .then((r) => r.json())
      .then(setAgents)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = agents.length;
    const active = agents.filter((a) => a.enabled).length;
    return { total, active, disabled: total - active };
  }, [agents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (filter === "active" && !a.enabled) return false;
      if (filter === "disabled" && a.enabled) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.displayName ?? "").toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [agents, filter, query]);

  return (
    <div className="nf-page nf-scroll h-full overflow-y-auto p-6 pb-16">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nf-border-invisible)] pb-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="nf-nano">SYS / 01</span>
              <span className="h-px w-10 bg-[var(--nf-border-visible)]" />
              <span className="nf-nano nf-text-accent">AGENT_REGISTRY</span>
            </div>
            <h1 className="nf-h1">Agents</h1>
            <p className="nf-sub max-w-2xl">
              Registered agent processes. Drop new agents into the <span className="nf-mono nf-text-accent2">agents/</span> directory to mount them here.
            </p>
          </div>
          <button type="button" className="nf-btn" onClick={load} disabled={loading}>
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <StatCell label="Total" value={stats.total} />
          <StatCell label="Active" value={stats.active} tone="accent" />
          <StatCell label="Disabled" value={stats.disabled} tone="muted" />
        </section>

        <section className="nf-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 nf-text-accent" />
              <h2 className="nf-h2">Registry</h2>
              <span className="nf-nano nf-mono nf-text-tertiary">{filtered.length} / {agents.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 nf-text-tertiary" />
                <input
                  className="nf-input pl-9 w-[240px]"
                  placeholder="filter by name / description"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <FilterTabs value={filter} onChange={setFilter} />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[84px] rounded-md border border-[var(--nf-border-invisible)] bg-[rgba(8,11,16,0.4)] animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="nf-empty">
              {agents.length === 0
                ? "No agents registered. Add agents to the agents/ directory to get started."
                : "No agents match the current filter."}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((agent) => (
                <li key={agent.id}>
                  <AgentRow agent={agent} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "accent" | "muted";
}) {
  const toneClass =
    tone === "accent"
      ? "nf-text-accent"
      : tone === "muted"
        ? "nf-text-tertiary"
        : "nf-text-primary";
  return (
    <div className="nf-panel p-4">
      <div className="nf-nano">{label}</div>
      <div className={cn("mt-2 font-mono text-[22px] tracking-[0.04em]", toneClass)}>
        {String(value).padStart(2, "0")}
      </div>
    </div>
  );
}

function FilterTabs({ value, onChange }: { value: Filter; onChange: (next: Filter) => void }) {
  const items: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "disabled", label: "Disabled" },
  ];
  return (
    <div className="inline-flex rounded-md border border-[var(--nf-border-invisible)] p-0.5">
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] rounded-[4px] transition-colors",
              active
                ? "nf-text-accent bg-[var(--nf-accent-muted)] shadow-[inset_0_-2px_0_var(--nf-accent)]"
                : "nf-text-secondary hover:nf-text-hover"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function AgentRow({ agent }: { agent: Agent }) {
  const created = new Date(agent.createdAt);
  const timestamp = Number.isFinite(created.getTime())
    ? created.toISOString().replace("T", " ").slice(0, 19)
    : "--";

  return (
    <div className="nf-card nf-card-hover group flex items-start justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "mt-1 h-2 w-2 rounded-full border",
            agent.enabled
              ? "border-[var(--nf-accent)] bg-[var(--nf-accent)] shadow-[0_0_6px_rgba(255,109,31,0.6)]"
              : "border-[var(--nf-border-visible)] bg-transparent"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] nf-text-primary tracking-[0.02em]">
              {agent.displayName || agent.name}
            </span>
            <span className="nf-mono text-[11px] nf-text-tertiary">[{agent.name}]</span>
          </div>
          {agent.description && (
            <p className="mt-1 line-clamp-2 text-xs nf-text-secondary tracking-[0.02em] leading-relaxed">
              {agent.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] nf-mono nf-text-tertiary tracking-[0.06em] uppercase">
            <span className="inline-flex items-center gap-1.5">
              <span className="nf-text-accent2">ID</span>
              <span>{agent.id.slice(0, 8)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="nf-text-accent2">CREATED</span>
              <span>{timestamp}</span>
            </span>
            {agent.config && (
              <span className="inline-flex items-center gap-1.5">
                <span className="nf-text-accent2">CFG</span>
                <span>{Object.keys(agent.config).length} keys</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("nf-tag", agent.enabled ? "" : "nf-tag-muted")}>
          {agent.enabled ? (
            <>
              <Power className="h-2.5 w-2.5" />
              Active
            </>
          ) : (
            "Disabled"
          )}
        </span>
        <button
          type="button"
          className="nf-btn hidden opacity-0 transition-opacity group-hover:flex group-hover:opacity-100 md:inline-flex"
          title="Configure"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Config
        </button>
      </div>
    </div>
  );
}
