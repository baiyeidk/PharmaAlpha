-- AlterTable
ALTER TABLE "Conversation"
ADD COLUMN "investmentProjectId" TEXT,
ADD COLUMN "conversationType" TEXT NOT NULL DEFAULT 'personal';

-- AlterTable
ALTER TABLE "WorkflowDraft"
ADD COLUMN "skillDefinitionId" TEXT,
ADD COLUMN "skillSopId" TEXT,
ADD COLUMN "sourceConversationId" TEXT,
ADD COLUMN "sessionType" TEXT NOT NULL DEFAULT 'legacy_workflow';

-- AlterTable
ALTER TABLE "WorkflowExecution"
ADD COLUMN "inputArtifactIds" JSONB,
ADD COLUMN "executionContext" JSONB;

-- CreateTable
CREATE TABLE "ProjectArtifact" (
    "id" TEXT NOT NULL,
    "investmentProjectId" TEXT NOT NULL,
    "createdByEmployeeProfileId" TEXT NOT NULL,
    "workflowDraftId" TEXT,
    "workflowExecutionId" TEXT,
    "skillDefinitionId" TEXT,
    "skillSopId" TEXT,
    "artifactType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "inputArtifactIds" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_investmentProjectId_idx" ON "Conversation"("investmentProjectId");

-- CreateIndex
CREATE INDEX "Conversation_conversationType_idx" ON "Conversation"("conversationType");

-- CreateIndex
CREATE INDEX "WorkflowDraft_skillDefinitionId_idx" ON "WorkflowDraft"("skillDefinitionId");

-- CreateIndex
CREATE INDEX "WorkflowDraft_skillSopId_idx" ON "WorkflowDraft"("skillSopId");

-- CreateIndex
CREATE INDEX "WorkflowDraft_sourceConversationId_idx" ON "WorkflowDraft"("sourceConversationId");

-- CreateIndex
CREATE INDEX "WorkflowDraft_sessionType_idx" ON "WorkflowDraft"("sessionType");

-- CreateIndex
CREATE INDEX "ProjectArtifact_investmentProjectId_idx" ON "ProjectArtifact"("investmentProjectId");

-- CreateIndex
CREATE INDEX "ProjectArtifact_createdByEmployeeProfileId_idx" ON "ProjectArtifact"("createdByEmployeeProfileId");

-- CreateIndex
CREATE INDEX "ProjectArtifact_workflowDraftId_idx" ON "ProjectArtifact"("workflowDraftId");

-- CreateIndex
CREATE INDEX "ProjectArtifact_workflowExecutionId_idx" ON "ProjectArtifact"("workflowExecutionId");

-- CreateIndex
CREATE INDEX "ProjectArtifact_skillDefinitionId_idx" ON "ProjectArtifact"("skillDefinitionId");

-- CreateIndex
CREATE INDEX "ProjectArtifact_skillSopId_idx" ON "ProjectArtifact"("skillSopId");

-- CreateIndex
CREATE INDEX "ProjectArtifact_artifactType_idx" ON "ProjectArtifact"("artifactType");

-- AddForeignKey
ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_investmentProjectId_fkey"
FOREIGN KEY ("investmentProjectId") REFERENCES "InvestmentProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraft"
ADD CONSTRAINT "WorkflowDraft_skillDefinitionId_fkey"
FOREIGN KEY ("skillDefinitionId") REFERENCES "SkillDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraft"
ADD CONSTRAINT "WorkflowDraft_skillSopId_fkey"
FOREIGN KEY ("skillSopId") REFERENCES "SkillSop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraft"
ADD CONSTRAINT "WorkflowDraft_sourceConversationId_fkey"
FOREIGN KEY ("sourceConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectArtifact"
ADD CONSTRAINT "ProjectArtifact_investmentProjectId_fkey"
FOREIGN KEY ("investmentProjectId") REFERENCES "InvestmentProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectArtifact"
ADD CONSTRAINT "ProjectArtifact_createdByEmployeeProfileId_fkey"
FOREIGN KEY ("createdByEmployeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectArtifact"
ADD CONSTRAINT "ProjectArtifact_workflowDraftId_fkey"
FOREIGN KEY ("workflowDraftId") REFERENCES "WorkflowDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectArtifact"
ADD CONSTRAINT "ProjectArtifact_workflowExecutionId_fkey"
FOREIGN KEY ("workflowExecutionId") REFERENCES "WorkflowExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectArtifact"
ADD CONSTRAINT "ProjectArtifact_skillDefinitionId_fkey"
FOREIGN KEY ("skillDefinitionId") REFERENCES "SkillDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectArtifact"
ADD CONSTRAINT "ProjectArtifact_skillSopId_fkey"
FOREIGN KEY ("skillSopId") REFERENCES "SkillSop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
