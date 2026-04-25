import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectConversationAccess } from "@/lib/employee-investment";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");

  if (conversationId) {
    const access = await getProjectConversationAccess(session, conversationId);
    if (!access) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { agent: { select: { name: true, displayName: true } } },
        },
      },
    });

    return NextResponse.json(conversation);
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(conversations);
}
