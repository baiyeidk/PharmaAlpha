-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "focusAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSocialAccount" (
    "id" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accountRef" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeObservation" (
    "id" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "metadata" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeInvestmentBehavior" (
    "id" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "thesis" TEXT,
    "outcome" TEXT,
    "metadata" JSONB,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeInvestmentBehavior_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillDefinition" (
    "id" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "mergeMode" TEXT NOT NULL DEFAULT 'parallel',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillScript" (
    "id" TEXT NOT NULL,
    "skillDefinitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL,
    "entryPoint" TEXT,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "checksum" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillSop" (
    "id" TEXT NOT NULL,
    "skillDefinitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillSop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDraft" (
    "id" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "selectedSkills" JSONB,
    "config" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL,
    "workflowDraftId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dependsOn" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mergeMode" TEXT,
    "skillDefinitionId" TEXT,
    "skillSopId" TEXT,
    "params" JSONB,
    "position" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "workflowDraftId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "summary" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNodeRun" (
    "id" TEXT NOT NULL,
    "workflowExecutionId" TEXT NOT NULL,
    "workflowNodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNodeRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_employeeCode_key" ON "EmployeeProfile"("employeeCode");

-- CreateIndex
CREATE INDEX "EmployeeSocialAccount_employeeProfileId_idx" ON "EmployeeSocialAccount"("employeeProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSocialAccount_employeeProfileId_platform_accountRef_key" ON "EmployeeSocialAccount"("employeeProfileId", "platform", "accountRef");

-- CreateIndex
CREATE INDEX "EmployeeObservation_employeeProfileId_idx" ON "EmployeeObservation"("employeeProfileId");

-- CreateIndex
CREATE INDEX "EmployeeObservation_category_idx" ON "EmployeeObservation"("category");

-- CreateIndex
CREATE INDEX "EmployeeInvestmentBehavior_employeeProfileId_idx" ON "EmployeeInvestmentBehavior"("employeeProfileId");

-- CreateIndex
CREATE INDEX "EmployeeInvestmentBehavior_target_idx" ON "EmployeeInvestmentBehavior"("target");

-- CreateIndex
CREATE INDEX "EmployeeInvestmentBehavior_action_idx" ON "EmployeeInvestmentBehavior"("action");

-- CreateIndex
CREATE INDEX "SkillDefinition_employeeProfileId_idx" ON "SkillDefinition"("employeeProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDefinition_employeeProfileId_name_key" ON "SkillDefinition"("employeeProfileId", "name");

-- CreateIndex
CREATE INDEX "SkillScript_skillDefinitionId_idx" ON "SkillScript"("skillDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillScript_skillDefinitionId_name_version_key" ON "SkillScript"("skillDefinitionId", "name", "version");

-- CreateIndex
CREATE INDEX "SkillSop_skillDefinitionId_idx" ON "SkillSop"("skillDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillSop_skillDefinitionId_name_key" ON "SkillSop"("skillDefinitionId", "name");

-- CreateIndex
CREATE INDEX "WorkflowDraft_employeeProfileId_idx" ON "WorkflowDraft"("employeeProfileId");

-- CreateIndex
CREATE INDEX "WorkflowDraft_status_idx" ON "WorkflowDraft"("status");

-- CreateIndex
CREATE INDEX "WorkflowNode_workflowDraftId_idx" ON "WorkflowNode"("workflowDraftId");

-- CreateIndex
CREATE INDEX "WorkflowNode_nodeType_idx" ON "WorkflowNode"("nodeType");

-- CreateIndex
CREATE INDEX "WorkflowNode_skillDefinitionId_idx" ON "WorkflowNode"("skillDefinitionId");

-- CreateIndex
CREATE INDEX "WorkflowNode_skillSopId_idx" ON "WorkflowNode"("skillSopId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowNode_workflowDraftId_nodeKey_key" ON "WorkflowNode"("workflowDraftId", "nodeKey");

-- CreateIndex
CREATE INDEX "WorkflowExecution_workflowDraftId_idx" ON "WorkflowExecution"("workflowDraftId");

-- CreateIndex
CREATE INDEX "WorkflowExecution_employeeProfileId_idx" ON "WorkflowExecution"("employeeProfileId");

-- CreateIndex
CREATE INDEX "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");

-- CreateIndex
CREATE INDEX "WorkflowNodeRun_workflowExecutionId_idx" ON "WorkflowNodeRun"("workflowExecutionId");

-- CreateIndex
CREATE INDEX "WorkflowNodeRun_workflowNodeId_idx" ON "WorkflowNodeRun"("workflowNodeId");

-- CreateIndex
CREATE INDEX "WorkflowNodeRun_status_idx" ON "WorkflowNodeRun"("status");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSocialAccount" ADD CONSTRAINT "EmployeeSocialAccount_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeObservation" ADD CONSTRAINT "EmployeeObservation_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeInvestmentBehavior" ADD CONSTRAINT "EmployeeInvestmentBehavior_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDefinition" ADD CONSTRAINT "SkillDefinition_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillScript" ADD CONSTRAINT "SkillScript_skillDefinitionId_fkey" FOREIGN KEY ("skillDefinitionId") REFERENCES "SkillDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillSop" ADD CONSTRAINT "SkillSop_skillDefinitionId_fkey" FOREIGN KEY ("skillDefinitionId") REFERENCES "SkillDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraft" ADD CONSTRAINT "WorkflowDraft_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_workflowDraftId_fkey" FOREIGN KEY ("workflowDraftId") REFERENCES "WorkflowDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_skillDefinitionId_fkey" FOREIGN KEY ("skillDefinitionId") REFERENCES "SkillDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_skillSopId_fkey" FOREIGN KEY ("skillSopId") REFERENCES "SkillSop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowDraftId_fkey" FOREIGN KEY ("workflowDraftId") REFERENCES "WorkflowDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNodeRun" ADD CONSTRAINT "WorkflowNodeRun_workflowExecutionId_fkey" FOREIGN KEY ("workflowExecutionId") REFERENCES "WorkflowExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNodeRun" ADD CONSTRAINT "WorkflowNodeRun_workflowNodeId_fkey" FOREIGN KEY ("workflowNodeId") REFERENCES "WorkflowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
