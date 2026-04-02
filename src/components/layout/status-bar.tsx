import { getSession } from "@/lib/auth";
import { StatusBarClient } from "./status-bar-client";

export async function StatusBar() {
  const session = await getSession();
  const initials =
    session?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return <StatusBarClient email={session?.email ?? ""} initials={initials} />;
}
