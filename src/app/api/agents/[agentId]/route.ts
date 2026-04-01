import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAgentById } from "@/lib/agents";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId } = await params;
  const agent = await getAgentById(agentId);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(agent);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId } = await params;
  const body = await req.json();

  const agent = await prisma.agent.update({
    where: { id: agentId },
    data: {
      displayName: body.displayName,
      description: body.description,
      enabled: body.enabled,
      config: body.config,
    },
  });

  return NextResponse.json(agent);
}
