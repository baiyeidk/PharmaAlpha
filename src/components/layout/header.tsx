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
    <header className="flex h-10 items-center justify-between border-b border-border/40 bg-background/60 backdrop-blur-sm px-4">
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground uppercase tracking-wider">
        <div className="h-1.5 w-1.5 rounded-full bg-pa-green animate-pulse" />
        System Online
      </div>
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {session?.email}
        </span>
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-card text-xs font-mono font-medium text-pa-cyan">
          {initials}
        </div>
      </div>
    </header>
  );
}
