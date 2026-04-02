-- CreateTable
CREATE TABLE "ConversationFile" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationFile_conversationId_idx" ON "ConversationFile"("conversationId");

-- AddForeignKey
ALTER TABLE "ConversationFile" ADD CONSTRAINT "ConversationFile_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
