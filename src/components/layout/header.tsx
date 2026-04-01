import { getSession } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export async function Header() {
  const session = await getSession();
  const initials =
    session?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {session?.name || session?.email}
        </span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
