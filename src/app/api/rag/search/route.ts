import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query, topK = 5 } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const documents = await prisma.rAGDocument.findMany({
      where: { userId: session.id },
      include: {
        chunks: true,
      },
    });

    const allChunks = documents.flatMap(doc =>
      doc.chunks.map(chunk => ({
        ...chunk,
        documentTitle: doc.title,
        documentSource: doc.source,
      }))
    );

    const scoredChunks = allChunks.map(chunk => {
      const score = calculateRelevanceScore(query, chunk.content);
      return { ...chunk, score };
    });

    const topChunks = scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ score, ...rest }) => rest);

    return NextResponse.json({
      query,
      results: topChunks,
      total: allChunks.length,
    });
  } catch (error) {
    console.error("Failed to search RAG:", error);
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}

function calculateRelevanceScore(query: string, content: string): number {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();

  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const contentWords = contentLower.split(/\s+/);

  let score = 0;
  let matchedWords = 0;

  for (const queryWord of queryWords) {
    if (contentLower.includes(queryWord)) {
      matchedWords++;
      score += 1;

      const exactMatches = (contentLower.match(new RegExp(queryWord, 'g')) || []).length;
      score += exactMatches * 0.5;
    }
  }

  if (matchedWords > 0) {
    score += (matchedWords / queryWords.length) * 2;
  }

  return score;
}
