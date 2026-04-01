import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await getSession();

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Name: </span>
            <span className="text-sm">{session?.name || "—"}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Email: </span>
            <span className="text-sm">{session?.email || "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
