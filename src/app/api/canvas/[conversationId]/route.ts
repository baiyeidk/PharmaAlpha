import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: session.id },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [nodes, edges] = await Promise.all([
    prisma.canvasNode.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.canvasEdge.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({ nodes, edges });
}

interface NodePayload {
  id?: string;
  type: string;
  label: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  data?: Prisma.InputJsonValue;
}

interface EdgePayload {
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
  animated?: boolean;
  style?: Prisma.InputJsonValue;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: session.id },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const incoming: NodePayload[] = body.nodes;
  const incomingEdges: EdgePayload[] = body.edges || [];

  if (!Array.isArray(incoming)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const incomingIds = incoming.filter((n) => n.id).map((n) => n.id!);
  await prisma.canvasNode.deleteMany({
    where: { conversationId, id: { notIn: incomingIds } },
  });

  for (const node of incoming) {
    const nodeData = node.data ?? Prisma.JsonNull;
    if (node.id) {
      await prisma.canvasNode.upsert({
        where: { id: node.id },
        update: {
          type: node.type,
          label: node.label,
          positionX: node.positionX,
          positionY: node.positionY,
          width: node.width,
          height: node.height,
          data: nodeData,
        },
        create: {
          id: node.id,
          conversationId,
          type: node.type,
          label: node.label,
          positionX: node.positionX,
          positionY: node.positionY,
          width: node.width,
          height: node.height,
          data: nodeData,
        },
      });
    } else {
      await prisma.canvasNode.create({
        data: {
          conversationId,
          type: node.type,
          label: node.label,
          positionX: node.positionX,
          positionY: node.positionY,
          width: node.width,
          height: node.height,
          data: nodeData,
        },
      });
    }
  }

  const edgeIds = incomingEdges.filter((e) => e.id).map((e) => e.id!);
  await prisma.canvasEdge.deleteMany({
    where: { conversationId, id: { notIn: edgeIds } },
  });

  for (const edge of incomingEdges) {
    const edgeStyle = edge.style ?? Prisma.JsonNull;
    if (edge.id) {
      await prisma.canvasEdge.upsert({
        where: { id: edge.id },
        update: {
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          animated: edge.animated ?? true,
          style: edgeStyle,
        },
        create: {
          id: edge.id,
          conversationId,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          animated: edge.animated ?? true,
          style: edgeStyle,
        },
      });
    } else {
      await prisma.canvasEdge.create({
        data: {
          conversationId,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          animated: edge.animated ?? true,
          style: edgeStyle,
        },
      });
    }
  }

  const [nodes, edges] = await Promise.all([
    prisma.canvasNode.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.canvasEdge.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({ nodes, edges });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: session.id },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const nodeData: Prisma.InputJsonValue = body.data ?? Prisma.JsonNull;
  const node = await prisma.canvasNode.create({
    data: {
      conversationId,
      type: body.type,
      label: body.label || "",
      positionX: body.positionX ?? 0,
      positionY: body.positionY ?? 0,
      width: body.width ?? 320,
      height: body.height ?? 240,
      data: nodeData,
    },
  });

  return NextResponse.json({ node }, { status: 201 });
}
