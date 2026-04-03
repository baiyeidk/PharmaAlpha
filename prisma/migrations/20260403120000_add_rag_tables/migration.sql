-- CreateRAGTables
-- Add RAG (Retrieval-Augmented Generation) tables

CREATE TABLE "RAGDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "metadata" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RAGDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RAGDocument_userId_idx" ON "RAGDocument"("userId");

CREATE TABLE "RAGChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RAGChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RAGChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RAGDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RAGChunk_documentId_idx" ON "RAGChunk"("documentId");
CREATE INDEX "RAGChunk_chunkIndex_idx" ON "RAGChunk"("chunkIndex");
