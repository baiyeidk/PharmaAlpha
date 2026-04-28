import { getSession } from "@/lib/auth";
import { CheckCircle2, Cpu, Monitor, User2 } from "lucide-react";
import { LlmSettingsPanel } from "@/components/settings/llm-settings-panel";
import { EmbeddingSettingsPanel } from "@/components/settings/embedding-settings-panel";

export default async function SettingsPage() {
  const session = await getSession();

  const profileRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Name", value: session?.name || "—" },
    { label: "Email", value: session?.email || "—", mono: true },
    { label: "User ID", value: session?.id || "—", mono: true },
  ];

  const systemRows: { label: string; value: string; tone?: "accent" | "success" }[] = [
    { label: "Version", value: "1.0.0" },
    { label: "Build", value: "STABLE" },
    { label: "CRT FX", value: "ENABLED", tone: "success" },
    { label: "Theme", value: "NEXUS_DARK_FUI", tone: "accent" },
  ];

  return (
    <div className="nf-scroll h-full overflow-y-auto p-6 pb-16">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nf-border-invisible)] pb-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="nf-nano">SYS / 04</span>
              <span className="h-px w-10 bg-[var(--nf-border-visible)]" />
              <span className="nf-nano nf-text-accent">OPERATOR_CONFIG</span>
            </div>
            <h1 className="nf-h1">Settings</h1>
            <p className="nf-sub max-w-2xl">
              Read-only snapshot of the current session and runtime. Full mutation surface arrives in a later build.
            </p>
          </div>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="nf-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User2 className="h-3.5 w-3.5 nf-text-accent" />
                <h2 className="nf-h2">Profile</h2>
              </div>
              <span className="nf-nano">01</span>
            </div>
            <dl className="flex flex-col gap-3">
              {profileRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[90px_1fr] items-center gap-3 border-b border-[var(--nf-border-invisible)] pb-3 last:border-0 last:pb-0"
                >
                  <dt className="nf-nano">{row.label}</dt>
                  <dd
                    className={`truncate text-[13px] nf-text-primary tracking-[0.02em] ${row.mono ? "nf-mono" : ""}`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="nf-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 nf-text-accent" />
                <h2 className="nf-h2">Runtime</h2>
              </div>
              <span className="nf-nano">02</span>
            </div>
            <dl className="flex flex-col gap-3">
              {systemRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[90px_1fr] items-center gap-3 border-b border-[var(--nf-border-invisible)] pb-3 last:border-0 last:pb-0"
                >
                  <dt className="nf-nano">{row.label}</dt>
                  <dd className="flex items-center gap-2 text-[13px] nf-mono tracking-[0.04em]">
                    {row.tone === "accent" && (
                      <span className="nf-text-accent">{row.value}</span>
                    )}
                    {row.tone === "success" && (
                      <span className="inline-flex items-center gap-1.5 nf-text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        {row.value}
                      </span>
                    )}
                    {!row.tone && <span className="nf-text-primary">{row.value}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="nf-card p-5 md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-3.5 w-3.5 nf-text-accent" />
                <h2 className="nf-h2">Display</h2>
              </div>
              <span className="nf-nano">03</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <PaletteSwatch name="bg-base" value="#201f1d" />
              <PaletteSwatch name="bg-surface" value="#262522" />
              <PaletteSwatch name="bg-elevated" value="#2d2c28" />
              <PaletteSwatch name="accent" value="#ff6d1f" glow />
              <PaletteSwatch name="accent2" value="#e0a848" />
              <PaletteSwatch name="border" value="#2a2a2a" />
            </div>
          </section>

          <LlmSettingsPanel />
          <EmbeddingSettingsPanel />
        </div>
      </div>
    </div>
  );
}

function PaletteSwatch({
  name,
  value,
  glow = false,
}: {
  name: string;
  value: string;
  glow?: boolean;
}) {
  return (
    <div className="nf-panel flex items-center gap-3 p-3">
      <span
        className="h-8 w-8 shrink-0 rounded-[4px] border border-[var(--nf-border-visible)]"
        style={{
          background: value,
          boxShadow: glow
            ? "0 0 4px rgba(255, 109, 31, 0.45), inset 0 0 8px rgba(0,0,0,0.3)"
            : "inset 0 0 8px rgba(0,0,0,0.3)",
        }}
      />
      <div className="min-w-0">
        <div className="nf-nano">{name}</div>
        <div className="nf-mono text-[11px] nf-text-input tracking-[0.04em]">{value}</div>
      </div>
    </div>
  );
}
