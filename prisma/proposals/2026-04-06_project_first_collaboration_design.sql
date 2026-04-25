-- Review-only SQL draft for the project-first collaboration design.
-- Do not treat this file as an applied Prisma migration.
-- Review date: 2026-04-06

BEGIN;

-- 1. Bind one primary conversation to an investment project.
-- We keep Conversation as the reuse point for the existing chat + canvas stack.
ALTER TABLE "Conversation"
ADD COLUMN IF NOT EXISTS "investmentProjectId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_investmentProjectId_key"
ON "Conversation"("investmentProjectId")
WHERE "investmentProjectId" IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Conversation_investmentProjectId_fkey'
    ) THEN
        ALTER TABLE "Conversation"
        ADD CONSTRAINT "Conversation_investmentProjectId_fkey"
        FOREIGN KEY ("investmentProjectId")
        REFERENCES "InvestmentProject"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

-- 2. Explicit artifact table for board outputs.
CREATE TABLE IF NOT EXISTS "ProjectArtifact" (
    "id" TEXT NOT NULL,
    "investmentProjectId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "workflowDraftId" TEXT,
    "skillDefinitionId" TEXT,
    "skillSopId" TEXT,
    "conversationId" TEXT,
    "artifactType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "attachments" JSONB,
    "inputArtifactIds" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectArtifact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectArtifact_investmentProjectId_idx"
ON "ProjectArtifact"("investmentProjectId");

CREATE INDEX IF NOT EXISTS "ProjectArtifact_employeeProfileId_idx"
ON "ProjectArtifact"("employeeProfileId");

CREATE INDEX IF NOT EXISTS "ProjectArtifact_workflowDraftId_idx"
ON "ProjectArtifact"("workflowDraftId");

CREATE INDEX IF NOT EXISTS "ProjectArtifact_skillDefinitionId_idx"
ON "ProjectArtifact"("skillDefinitionId");

CREATE INDEX IF NOT EXISTS "ProjectArtifact_conversationId_idx"
ON "ProjectArtifact"("conversationId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProjectArtifact_investmentProjectId_fkey'
    ) THEN
        ALTER TABLE "ProjectArtifact"
        ADD CONSTRAINT "ProjectArtifact_investmentProjectId_fkey"
        FOREIGN KEY ("investmentProjectId")
        REFERENCES "InvestmentProject"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProjectArtifact_employeeProfileId_fkey'
    ) THEN
        ALTER TABLE "ProjectArtifact"
        ADD CONSTRAINT "ProjectArtifact_employeeProfileId_fkey"
        FOREIGN KEY ("employeeProfileId")
        REFERENCES "EmployeeProfile"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProjectArtifact_workflowDraftId_fkey'
    ) THEN
        ALTER TABLE "ProjectArtifact"
        ADD CONSTRAINT "ProjectArtifact_workflowDraftId_fkey"
        FOREIGN KEY ("workflowDraftId")
        REFERENCES "WorkflowDraft"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProjectArtifact_skillDefinitionId_fkey'
    ) THEN
        ALTER TABLE "ProjectArtifact"
        ADD CONSTRAINT "ProjectArtifact_skillDefinitionId_fkey"
        FOREIGN KEY ("skillDefinitionId")
        REFERENCES "SkillDefinition"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProjectArtifact_skillSopId_fkey'
    ) THEN
        ALTER TABLE "ProjectArtifact"
        ADD CONSTRAINT "ProjectArtifact_skillSopId_fkey"
        FOREIGN KEY ("skillSopId")
        REFERENCES "SkillSop"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProjectArtifact_conversationId_fkey'
    ) THEN
        ALTER TABLE "ProjectArtifact"
        ADD CONSTRAINT "ProjectArtifact_conversationId_fkey"
        FOREIGN KEY ("conversationId")
        REFERENCES "Conversation"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. Upgrade WorkflowDraft from generic draft to explicit skill session.
ALTER TABLE "WorkflowDraft"
ADD COLUMN IF NOT EXISTS "sessionType" TEXT NOT NULL DEFAULT 'skill_session';

ALTER TABLE "WorkflowDraft"
ADD COLUMN IF NOT EXISTS "skillDefinitionId" TEXT;

ALTER TABLE "WorkflowDraft"
ADD COLUMN IF NOT EXISTS "skillSopId" TEXT;

ALTER TABLE "WorkflowDraft"
ADD COLUMN IF NOT EXISTS "sourceConversationId" TEXT;

ALTER TABLE "WorkflowDraft"
ADD COLUMN IF NOT EXISTS "finalArtifactId" TEXT;

CREATE INDEX IF NOT EXISTS "WorkflowDraft_skillDefinitionId_idx"
ON "WorkflowDraft"("skillDefinitionId");

CREATE INDEX IF NOT EXISTS "WorkflowDraft_skillSopId_idx"
ON "WorkflowDraft"("skillSopId");

CREATE INDEX IF NOT EXISTS "WorkflowDraft_sourceConversationId_idx"
ON "WorkflowDraft"("sourceConversationId");

CREATE INDEX IF NOT EXISTS "WorkflowDraft_finalArtifactId_idx"
ON "WorkflowDraft"("finalArtifactId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowDraft_skillDefinitionId_fkey'
    ) THEN
        ALTER TABLE "WorkflowDraft"
        ADD CONSTRAINT "WorkflowDraft_skillDefinitionId_fkey"
        FOREIGN KEY ("skillDefinitionId")
        REFERENCES "SkillDefinition"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowDraft_skillSopId_fkey'
    ) THEN
        ALTER TABLE "WorkflowDraft"
        ADD CONSTRAINT "WorkflowDraft_skillSopId_fkey"
        FOREIGN KEY ("skillSopId")
        REFERENCES "SkillSop"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowDraft_sourceConversationId_fkey'
    ) THEN
        ALTER TABLE "WorkflowDraft"
        ADD CONSTRAINT "WorkflowDraft_sourceConversationId_fkey"
        FOREIGN KEY ("sourceConversationId")
        REFERENCES "Conversation"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowDraft_finalArtifactId_fkey'
    ) THEN
        ALTER TABLE "WorkflowDraft"
        ADD CONSTRAINT "WorkflowDraft_finalArtifactId_fkey"
        FOREIGN KEY ("finalArtifactId")
        REFERENCES "ProjectArtifact"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

COMMIT;
