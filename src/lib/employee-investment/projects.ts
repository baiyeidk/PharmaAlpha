import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { ensureEmployeeContext } from "./context";

export type EmployeeProjectAccess = Awaited<ReturnType<typeof getEmployeeProjectAccess>>;

export function isEmployeeProjectAccessOpen() {
  return process.env.EMPLOYEE_PROJECT_ACCESS_OPEN !== "false";
}

export function createProjectCode() {
  return `proj-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export async function getEmployeeProjectAccess(session: SessionUser, projectId: string) {
  const employee = await ensureEmployeeContext(session);
  const membership = await prisma.investmentProjectMember.findFirst({
    where: {
      investmentProjectId: projectId,
      employeeProfileId: employee.profileId,
      status: "active",
    },
    include: {
      investmentProject: true,
      employeeProfile: true,
    },
  });
  const project =
    membership?.investmentProject ??
    (isEmployeeProjectAccessOpen()
      ? await prisma.investmentProject.findUnique({ where: { id: projectId } })
      : null);

  return {
    employee,
    membership,
    project,
  };
}

export async function assertEmployeeProjectAccess(session: SessionUser, projectId: string) {
  const access = await getEmployeeProjectAccess(session, projectId);
  if (!access.project || (!isEmployeeProjectAccessOpen() && !access.membership)) {
    throw new ProjectAccessError();
  }
  return {
    ...access,
    project: access.project,
  };
}

export async function getProjectConversationAccess(
  session: SessionUser,
  conversationId: string
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { investmentProject: true },
  });

  if (!conversation) return null;
  if (!conversation.investmentProjectId) {
    return conversation.userId === session.id ? { conversation, projectAccess: null } : null;
  }

  const projectAccess = await getEmployeeProjectAccess(
    session,
    conversation.investmentProjectId
  );
  if (!projectAccess.project) return null;

  return { conversation, projectAccess };
}

export async function getProjectMainConversation(projectId: string) {
  return prisma.conversation.findFirst({
    where: {
      investmentProjectId: projectId,
      conversationType: "project_main",
    },
    orderBy: { createdAt: "asc" },
  });
}

export function isProjectAccessError(error: unknown): error is ProjectAccessError {
  return error instanceof ProjectAccessError;
}

export class ProjectAccessError extends Error {
  constructor() {
    super("Project not found");
    this.name = "ProjectAccessError";
  }
}
