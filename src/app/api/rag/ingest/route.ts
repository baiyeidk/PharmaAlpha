import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { embedTexts } from "@/lib/embedding";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    const existing = await prisma.document.findUnique({ where: { fileHash: hash } });
    if (existing) {
      return NextResponse.json({
        documentId: existing.id,
        status: existing.status,
        message: "Document already exists",
      });
    }

    const filePath = path.join(UPLOAD_DIR, `${hash}${path.extname(file.name)}`);
    await fs.writeFile(filePath, buffer);

    const doc = await prisma.document.create({
      data: {
        userId: session.id,
        title: file.name,
        sourceType: "pdf",
        fileHash: hash,
        status: "pending",
        metadata: { originalName: file.name, size: file.size },
      },
    });

    triggerIngestion(doc.id, filePath).catch(console.error);

    return NextResponse.json({ documentId: doc.id, status: "processing" });
  }

  const body = await req.json();
  const { url, text, title } = body;

  if (!url && !text) {
    return NextResponse.json({ error: "url or text is required" }, { status: 400 });
  }

  const sourceType = url ? "web" : "manual";
  const hash = crypto
    .createHash("sha256")
    .update(url || text)
    .digest("hex");

  const existing = await prisma.document.findUnique({ where: { fileHash: hash } });
  if (existing) {
    return NextResponse.json({
      documentId: existing.id,
      status: existing.status,
      message: "Document already exists",
    });
  }

  const doc = await prisma.document.create({
    data: {
      userId: session.id,
      title: title || url || "Untitled",
      sourceType,
      sourceUrl: url || null,
      fileHash: hash,
      status: "processing",
    },
  });

  triggerIngestionFromTS(doc.id, { url, text, title, userId: session.id }).catch(
    console.error
  );

  return NextResponse.json({ documentId: doc.id, status: "processing" });
}

async function triggerIngestion(docId: string, filePath: string) {
  try {
    const { spawn } = await import("child_process");
    const agentsDir = path.resolve(process.cwd(), "agents");

    const proc = spawn(
      "python3",
      [
        "-c",
        `
import sys, os, json
sys.path.insert(0, "${agentsDir}")
os.environ["DATABASE_URL"] = "${process.env.DATABASE_URL}"
from base.rag.ingest import ingest_document
result = ingest_document(file_path="${filePath}")
print(json.dumps(result))
`,
      ],
      { cwd: agentsDir, env: { ...process.env, PYTHONPATH: agentsDir } }
    );

    proc.stderr?.on("data", (d: Buffer) => console.warn("ingest stderr:", d.toString()));
    proc.on("close", (code: number) => {
      if (code !== 0) console.error(`Ingestion process exited with code ${code}`);
    });
  } catch (err) {
    console.error("Failed to trigger ingestion:", err);
    await prisma.document.update({
      where: { id: docId },
      data: { status: "error" },
    });
  }
}

async function triggerIngestionFromTS(
  docId: string,
  params: { url?: string; text?: string; title?: string; userId: string }
) {
  try {
    await prisma.document.update({
      where: { id: docId },
      data: { status: "processing" },
    });

    let content = "";
    if (params.url) {
      const resp = await fetch(params.url, {
        headers: { "User-Agent": "PharmaAlpha/1.0" },
        signal: AbortSignal.timeout(30_000),
      });
      content = await resp.text();
      content = content.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
    } else if (params.text) {
      content = params.text;
    }

    if (!content) {
      await prisma.document.update({
        where: { id: docId },
        data: { status: "error", metadata: { error: "Empty content" } },
      });
      return;
    }

    const chunkSize = 1500;
    const overlap = 200;
    const textChunks: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      textChunks.push(content.slice(i, i + chunkSize));
    }

    const embeddings = await embedTexts(textChunks);

    for (let i = 0; i < textChunks.length; i++) {
      const vec = embeddings[i];
      if (vec) {
        const vecStr = `[${vec.join(",")}]`;
        await prisma.$queryRawUnsafe(
          `INSERT INTO "DocumentChunk" (id, "documentId", content, metadata, "chunkIndex", embedding, "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, '{}'::jsonb, $3, $4::vector, NOW())`,
          docId,
          textChunks[i],
          i,
          vecStr
        );
      } else {
        await prisma.$queryRawUnsafe(
          `INSERT INTO "DocumentChunk" (id, "documentId", content, metadata, "chunkIndex", "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, '{}'::jsonb, $3, NOW())`,
          docId,
          textChunks[i],
          i
        );
      }
    }

    await prisma.document.update({
      where: { id: docId },
      data: { status: "ready", chunkCount: textChunks.length },
    });
  } catch (err) {
    console.error("TS ingestion failed:", err);
    await prisma.document.update({
      where: { id: docId },
      data: { status: "error", metadata: { error: String(err) } },
    });
  }
}
