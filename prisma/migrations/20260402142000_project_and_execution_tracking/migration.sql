-- CreateTable
CREATE TABLE "InvestmentProject" (
    "id" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "objective" TEXT,
    "priority" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentProjectMember" (
    "id" TEXT NOT NULL,
    "investmentProjectId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isInitiator" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecutionEvent" (
    "id" TEXT NOT NULL,
    "workflowExecutionId" TEXT NOT NULL,
    "workflowNodeId" TEXT,
    "eventType" TEXT NOT NULL,
    "message" TEXT,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowExecutionEvent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "WorkflowDraft"
ADD COLUMN "investmentProjectId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowExecution"
ADD COLUMN "currentWorkflowNodeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentProject_projectCode_key" ON "InvestmentProject"("projectCode");

-- CreateIndex
CREATE INDEX "InvestmentProject_employeeProfileId_idx" ON "InvestmentProject"("employeeProfileId");

-- CreateIndex
CREATE INDEX "InvestmentProject_status_idx" ON "InvestmentProject"("status");

-- CreateIndex
CREATE INDEX "InvestmentProjectMember_investmentProjectId_idx" ON "InvestmentProjectMember"("investmentProjectId");

-- CreateIndex
CREATE INDEX "InvestmentProjectMember_employeeProfileId_idx" ON "InvestmentProjectMember"("employeeProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentProjectMember_investmentProjectId_employeeProfileI_key"
ON "InvestmentProjectMember"("investmentProjectId", "employeeProfileId");

-- CreateIndex
CREATE INDEX "WorkflowExecutionEvent_workflowExecutionId_idx" ON "WorkflowExecutionEvent"("workflowExecutionId");

-- CreateIndex
CREATE INDEX "WorkflowExecutionEvent_workflowNodeId_idx" ON "WorkflowExecutionEvent"("workflowNodeId");

-- CreateIndex
CREATE INDEX "WorkflowExecutionEvent_eventType_idx" ON "WorkflowExecutionEvent"("eventType");

-- CreateIndex
CREATE INDEX "WorkflowDraft_investmentProjectId_idx" ON "WorkflowDraft"("investmentProjectId");

-- CreateIndex
CREATE INDEX "WorkflowExecution_currentWorkflowNodeId_idx" ON "WorkflowExecution"("currentWorkflowNodeId");

-- AddForeignKey
ALTER TABLE "InvestmentProject"
ADD CONSTRAINT "InvestmentProject_employeeProfileId_fkey"
FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentProjectMember"
ADD CONSTRAINT "InvestmentProjectMember_investmentProjectId_fkey"
FOREIGN KEY ("investmentProjectId") REFERENCES "InvestmentProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentProjectMember"
ADD CONSTRAINT "InvestmentProjectMember_employeeProfileId_fkey"
FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDraft"
ADD CONSTRAINT "WorkflowDraft_investmentProjectId_fkey"
FOREIGN KEY ("investmentProjectId") REFERENCES "InvestmentProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution"
ADD CONSTRAINT "WorkflowExecution_currentWorkflowNodeId_fkey"
FOREIGN KEY ("currentWorkflowNodeId") REFERENCES "WorkflowNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecutionEvent"
ADD CONSTRAINT "WorkflowExecutionEvent_workflowExecutionId_fkey"
FOREIGN KEY ("workflowExecutionId") REFERENCES "WorkflowExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecutionEvent"
ADD CONSTRAINT "WorkflowExecutionEvent_workflowNodeId_fkey"
FOREIGN KEY ("workflowNodeId") REFERENCES "WorkflowNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
