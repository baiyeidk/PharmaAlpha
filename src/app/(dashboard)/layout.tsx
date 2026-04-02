import { IconRail } from "@/components/layout/icon-rail";
import { StatusBar } from "@/components/layout/status-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <IconRail />
      <div className="flex flex-1 flex-col overflow-hidden">
        <StatusBar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
