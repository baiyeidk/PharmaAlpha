import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await prisma.rAGDocument.findUnique({
      where: { id: params.documentId },
      include: {
        chunks: {
          orderBy: { chunkIndex: "asc" },
        },
      },
    });

    if (!document || document.userId !== session.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Failed to fetch RAG document:", error);
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await prisma.rAGDocument.findUnique({
      where: { id: params.documentId },
    });

    if (!document || document.userId !== session.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    await prisma.rAGDocument.delete({
      where: { id: params.documentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete RAG document:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
