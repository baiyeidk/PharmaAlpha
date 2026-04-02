import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const conversationId = formData.get("conversationId") as string | null;

  if (!file || !conversationId) {
    return NextResponse.json(
      { error: "Missing file or conversationId" },
      { status: 400 },
    );
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: session.id },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const convDir = path.join(UPLOAD_DIR, conversationId);
  await mkdir(convDir, { recursive: true });

  const ext = path.extname(file.name) || "";
  const filename = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(convDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const record = await prisma.conversationFile.create({
    data: {
      conversationId,
      filename,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: buffer.length,
      path: `${conversationId}/${filename}`,
    },
  });

  return NextResponse.json({
    id: record.id,
    url: `/api/files/${record.id}`,
    originalName: record.originalName,
    mimeType: record.mimeType,
    size: record.size,
  });
}
