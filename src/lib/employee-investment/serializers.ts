import type {
  Conversation,
  EmployeeProfile,
  InvestmentProject,
  InvestmentProjectMember,
  ProjectArtifact,
  SkillDefinition,
  SkillSop,
  WorkflowDraft,
  WorkflowExecution,
} from "@/generated/prisma/client";

type ProjectMemberWithProfile = InvestmentProjectMember & {
  employeeProfile: Pick<
    EmployeeProfile,
    "id" | "employeeCode" | "displayName" | "title" | "department" | "focusAreas" | "tags"
  >;
};

export function serializeProject(
  project: InvestmentProject & {
    members?: ProjectMemberWithProfile[];
    conversations?: Pick<Conversation, "id" | "title" | "conversationType" | "updatedAt">[];
    _count?: { artifacts?: number; workflowDrafts?: number };
  }
) {
  const mainConversation = project.conversations?.find(
    (conversation) => conversation.conversationType === "project_main"
  );

  return {
    id: project.id,
    projectCode: project.projectCode,
    title: project.title,
    topic: project.topic,
    status: project.status,
    objective: project.objective,
    priority: project.priority,
    config: project.config,
    mainConversationId: mainConversation?.id ?? null,
    members:
      project.members?.map((member) => ({
        id: member.id,
        role: member.role,
        status: member.status,
        isInitiator: member.isInitiator,
        joinedAt: member.joinedAt,
        employee: member.employeeProfile,
      })) ?? [],
    artifactCount: project._count?.artifacts ?? 0,
    sessionCount: project._count?.workflowDrafts ?? 0,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function serializeArtifact(
  artifact: ProjectArtifact & {
    createdByEmployeeProfile?: Pick<
      EmployeeProfile,
      "id" | "employeeCode" | "displayName" | "title"
    >;
    skillDefinition?: Pick<SkillDefinition, "id" | "name" | "description"> | null;
    skillSop?: Pick<SkillSop, "id" | "name" | "description"> | null;
  }
) {
  return {
    id: artifact.id,
    investmentProjectId: artifact.investmentProjectId,
    artifactType: artifact.artifactType,
    title: artifact.title,
    content: artifact.content,
    attachments: artifact.attachments,
    inputArtifactIds: artifact.inputArtifactIds,
    metadata: artifact.metadata,
    workflowDraftId: artifact.workflowDraftId,
    workflowExecutionId: artifact.workflowExecutionId,
    skillDefinitionId: artifact.skillDefinitionId,
    skillSopId: artifact.skillSopId,
    createdByEmployee: artifact.createdByEmployeeProfile ?? null,
    skill: artifact.skillDefinition ?? null,
    sop: artifact.skillSop ?? null,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  };
}

export function serializeSession(
  draft: WorkflowDraft & {
    skillDefinition?: Pick<SkillDefinition, "id" | "name" | "description"> | null;
    skillSop?: Pick<SkillSop, "id" | "name" | "description"> | null;
    executions?: Pick<WorkflowExecution, "id" | "status" | "summary" | "createdAt" | "finishedAt">[];
    _count?: { nodes?: number; projectArtifacts?: number };
  }
) {
  return {
    id: draft.id,
    investmentProjectId: draft.investmentProjectId,
    employeeProfileId: draft.employeeProfileId,
    topic: draft.topic,
    status: draft.status,
    sessionType: draft.sessionType,
    selectedSkills: draft.selectedSkills,
    config: draft.config,
    skill: draft.skillDefinition ?? null,
    sop: draft.skillSop ?? null,
    sourceConversationId: draft.sourceConversationId,
    nodeCount: draft._count?.nodes ?? 0,
    artifactCount: draft._count?.projectArtifacts ?? 0,
    executions: draft.executions ?? [],
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}
