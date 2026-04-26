import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const INTERNAL_API_KEY = process.env.AGENT_API_KEY || "pharma-agent-internal-key";

function getAgentUserId(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (token !== INTERNAL_API_KEY) return null;
  return req.headers.get("x-agent-user-id");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await getSession();
  const agentUserId = getAgentUserId(req);
  const userId = session?.id || agentUserId;
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { fileId } = await params;

  let file = await prisma.conversationFile.findFirst({
    where: {
      id: fileId,
      conversation: { userId },
    },
    include: { conversation: { select: { userId: true } } },
  });

  if (!file) {
    // Backward compatibility: some tool prompts pass original filename instead of file id.
    file = await prisma.conversationFile.findFirst({
      where: {
        originalName: fileId,
        conversation: { userId },
      },
      orderBy: { createdAt: "desc" },
      include: { conversation: { select: { userId: true } } },
    });
  }

  if (!file) return new NextResponse("Not found", { status: 404 });

  const filePath = path.join(UPLOAD_DIR, file.path);

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("File not found", { status: 404 });
  }
}
