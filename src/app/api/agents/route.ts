import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAgents, syncAgentsToDatabase } from "@/lib/agents";

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncAgentsToDatabase();
  const agents = await getAgents();

  return NextResponse.json(agents);
}
