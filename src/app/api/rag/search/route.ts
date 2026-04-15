import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { embedText } from "@/lib/embedding";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query, top_k = 5, doc_type } = await req.json();
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const vec = await embedText(query);
  if (!vec) {
    return NextResponse.json({ error: "Failed to generate embedding" }, { status: 500 });
  }

  const vecStr = `[${vec.join(",")}]`;
  const limit = Math.min(top_k, 20);

  let rows: Array<{
    content: string;
    metadata: Record<string, unknown>;
    score: number;
    title: string;
    sourceType: string;
  }>;

  if (doc_type) {
    rows = await prisma.$queryRawUnsafe(
      `SELECT dc.content, dc.metadata,
              1 - (dc.embedding <=> $1::vector) AS score,
              d.title, d."sourceType"
       FROM "DocumentChunk" dc
       JOIN "Document" d ON dc."documentId" = d.id
       WHERE dc.embedding IS NOT NULL
         AND d.status = 'ready'
         AND d."sourceType" = $2
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $3`,
      vecStr,
      doc_type,
      limit
    );
  } else {
    rows = await prisma.$queryRawUnsafe(
      `SELECT dc.content, dc.metadata,
              1 - (dc.embedding <=> $1::vector) AS score,
              d.title, d."sourceType"
       FROM "DocumentChunk" dc
       JOIN "Document" d ON dc."documentId" = d.id
       WHERE dc.embedding IS NOT NULL
         AND d.status = 'ready'
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $2`,
      vecStr,
      limit
    );
  }

  const results = rows.map((r) => ({
    content: r.content,
    score: Number(r.score),
    metadata: {
      ...(r.metadata as Record<string, unknown>),
      docTitle: r.title,
      docType: r.sourceType,
    },
  }));

  return NextResponse.json({ results });
}
