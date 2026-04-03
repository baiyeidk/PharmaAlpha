import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documents = await prisma.rAGDocument.findMany({
      where: { userId: session.id },
      include: {
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            content: true,
            metadata: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Failed to fetch RAG documents:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, content, source, metadata } = await req.json();

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const document = await prisma.rAGDocument.create({
      data: {
        title,
        content,
        source,
        metadata,
        userId: session.id,
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Failed to create RAG document:", error);
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}
