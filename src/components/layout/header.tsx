import { getSession } from "@/lib/auth";

export async function Header() {
  const session = await getSession();
  const initials =
    session?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <header className="flex h-9 items-center justify-between border-b border-border bg-marrow/50 backdrop-blur-sm px-4 font-mono text-xs">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-vitals-green">
          <div className="h-1.5 w-1.5 rounded-full bg-vitals-green animate-pulse-glow" />
          <span className="uppercase tracking-widest">Vitals OK</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <span className="uppercase tracking-wider text-muted-foreground">O.R. Active</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{session?.email}</span>
        <div className="flex h-6 w-6 items-center justify-center rounded-sm border border-scrub/30 bg-scrub/10 text-[10px] font-bold text-scrub">
          {initials}
        </div>
      </div>
    </header>
  );
}
