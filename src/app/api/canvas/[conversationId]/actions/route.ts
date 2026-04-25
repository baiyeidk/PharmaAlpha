import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";
import { getProjectConversationAccess } from "@/lib/employee-investment";

const INTERNAL_API_KEY = process.env.AGENT_API_KEY || "pharma-agent-internal-key";

async function authenticate(req: Request, conversationId: string) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === INTERNAL_API_KEY) {
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      return conv ? { ok: true as const } : { ok: false as const, error: "Conversation not found" };
    }
  }

  const session = await getSession();
  if (!session) return { ok: false as const, error: "Unauthorized" };
  const access = await getProjectConversationAccess(session, conversationId);
  return access ? { ok: true as const } : { ok: false as const, error: "Not found" };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  const auth = await authenticate(req, conversationId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await req.json();
  const { action, ...args } = body;

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  try {
    switch (action) {
      case "add_node":
        return await addNode(conversationId, args);
      case "remove_node":
        return await removeNode(conversationId, args);
      case "update_node":
        return await updateNode(conversationId, args);
      case "list_nodes":
        return await listNodes(conversationId);
      case "clear":
        return await clearCanvas(conversationId);
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

async function addNode(conversationId: string, args: Record<string, unknown>) {
  const { type, label, tickers, content, url, description, width, height } = args;
  if (!type || !label) {
    return NextResponse.json({ error: "type and label are required" }, { status: 400 });
  }

  const existing = await prisma.canvasNode.findMany({
    where: { conversationId },
    select: { positionX: true, positionY: true, height: true },
  });
  const maxY = existing.length > 0
    ? Math.max(...existing.map((n) => n.positionY + n.height))
    : 0;

  const w = (width as number) ?? 340;
  const h = (height as number) ?? ((type as string) === "text" ? 180 : 280);

  const nodeData: Prisma.InputJsonValue = {
    label, nodeType: type, width: w, height: h,
    ...(tickers ? { tickers } : {}),
    ...(content ? { content } : {}),
    ...(url ? { url } : {}),
    ...(description ? { description } : {}),
  };

  const node = await prisma.canvasNode.create({
    data: {
      conversationId,
      type: type as string,
      label: (label as string) || "",
      positionX: (existing.length % 2) * 360 + 20,
      positionY: maxY + 30,
      width: w,
      height: h,
      data: nodeData,
    },
  });

  return NextResponse.json({ ok: true, node }, { status: 201 });
}

async function removeNode(conversationId: string, args: Record<string, unknown>) {
  const { nodeId } = args;
  if (!nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }
  await prisma.canvasNode.deleteMany({ where: { id: nodeId as string, conversationId } });
  await prisma.canvasEdge.deleteMany({
    where: {
      conversationId,
      OR: [{ sourceNodeId: nodeId as string }, { targetNodeId: nodeId as string }],
    },
  });
  return NextResponse.json({ ok: true });
}

async function updateNode(conversationId: string, args: Record<string, unknown>) {
  const { nodeId, label, content, tickers, description } = args;
  if (!nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }
  const existing = await prisma.canvasNode.findFirst({
    where: { id: nodeId as string, conversationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const currentData = (existing.data as Record<string, unknown>) || {};
  const patch: Record<string, unknown> = {};
  if (label !== undefined) patch.label = label;
  if (content !== undefined) patch.content = content;
  if (tickers !== undefined) patch.tickers = tickers;
  if (description !== undefined) patch.description = description;

  const newData = { ...currentData, ...patch } as Prisma.InputJsonValue;
  const node = await prisma.canvasNode.update({
    where: { id: nodeId as string },
    data: {
      label: (label as string) ?? existing.label,
      data: newData,
    },
  });
  return NextResponse.json({ ok: true, node });
}

async function listNodes(conversationId: string) {
  const [nodes, edges] = await Promise.all([
    prisma.canvasNode.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } }),
    prisma.canvasEdge.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } }),
  ]);
  return NextResponse.json({ ok: true, nodes, edges });
}

async function clearCanvas(conversationId: string) {
  await prisma.canvasEdge.deleteMany({ where: { conversationId } });
  await prisma.canvasNode.deleteMany({ where: { conversationId } });
  return NextResponse.json({ ok: true });
}
