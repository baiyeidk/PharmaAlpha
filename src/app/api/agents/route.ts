import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAgents, syncAgentsToDatabase } from "@/lib/agents";

export async function GET() {
  console.info("[api/agents] request received");
  const session = await getSession();
  if (!session?.id) {
    console.warn("[api/agents] unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncAgentsToDatabase();
  const agents = await getAgents();
  console.info(`[api/agents] ok count=${agents.length} user=${session.id}`);

  return NextResponse.json(agents);
}
