import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  assertEmployeeProjectAccess,
  getProjectMainConversation,
  isProjectAccessError,
} from "@/lib/employee-investment";
import { serializeSession } from "@/lib/employee-investment/serializers";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    await assertEmployeeProjectAccess(session, projectId);
    const drafts = await prisma.workflowDraft.findMany({
      where: {
        investmentProjectId: projectId,
        sessionType: { in: ["skill_session", "project_skill_session"] },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        skillDefinition: {
          select: { id: true, name: true, description: true },
        },
        skillSop: {
          select: { id: true, name: true, description: true },
        },
        executions: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            status: true,
            summary: true,
            createdAt: true,
            finishedAt: true,
          },
        },
        _count: {
          select: {
            nodes: true,
            projectArtifacts: true,
          },
        },
      },
    });

    return NextResponse.json({ sessions: drafts.map(serializeSession) });
  } catch (error) {
    if (isProjectAccessError(error)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const body = await req.json();
  const topic = String(body.topic || "").trim();
  const assigneeEmployeeProfileId = body.assigneeEmployeeProfileId
    ? String(body.assigneeEmployeeProfileId)
    : null;
  const skillDefinitionId = body.skillDefinitionId ? String(body.skillDefinitionId) : null;
  const skillSopId = body.skillSopId ? String(body.skillSopId) : null;
  const inputArtifactIds = Array.isArray(body.inputArtifactIds) ? body.inputArtifactIds : [];

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }
  if (!skillDefinitionId) {
    return NextResponse.json({ error: "skillDefinitionId is required" }, { status: 400 });
  }

  try {
    const access = await assertEmployeeProjectAccess(session, projectId);
    const assignedEmployeeProfileId = assigneeEmployeeProfileId || access.employee.profileId;
    const [skill, sop, mainConversation, inputArtifacts] = await Promise.all([
      prisma.skillDefinition.findFirst({
        where: {
          id: skillDefinitionId,
          employeeProfileId: assignedEmployeeProfileId,
          enabled: true,
        },
      }),
      skillSopId
        ? prisma.skillSop.findFirst({
            where: {
              id: skillSopId,
              skillDefinitionId,
            },
          })
        : Promise.resolve(null),
      getProjectMainConversation(projectId),
      inputArtifactIds.length
        ? prisma.projectArtifact.findMany({
            where: {
              id: { in: inputArtifactIds },
              investmentProjectId: projectId,
            },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    if (skillSopId && !sop) {
      return NextResponse.json({ error: "SOP not found" }, { status: 404 });
    }
    if (inputArtifacts.length !== inputArtifactIds.length) {
      return NextResponse.json({ error: "One or more input artifacts were not found" }, { status: 400 });
    }

    const draft = await prisma.workflowDraft.create({
      data: {
        employeeProfileId: assignedEmployeeProfileId,
        investmentProjectId: projectId,
        skillDefinitionId,
        skillSopId,
        sourceConversationId: mainConversation?.id,
        sessionType: "project_skill_session",
        topic,
        status: "draft",
        selectedSkills: [skill.name],
        config: {
          inputArtifactIds,
          source: "project_skill_session",
          assigneeEmployeeProfileId: assignedEmployeeProfileId,
          createdByEmployeeProfileId: access.employee.profileId,
        },
        nodes: {
          create: {
            nodeKey: "start",
            nodeType: skill.category || "skill_execution",
            title: skill.name,
            enabled: true,
            skillDefinitionId,
            skillSopId,
            params: {
              inputArtifactIds,
              projectId,
              assigneeEmployeeProfileId: assignedEmployeeProfileId,
            },
            position: 0,
          },
        },
      },
      include: {
        skillDefinition: {
          select: { id: true, name: true, description: true },
        },
        skillSop: {
          select: { id: true, name: true, description: true },
        },
        executions: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            status: true,
            summary: true,
            createdAt: true,
            finishedAt: true,
          },
        },
        _count: {
          select: {
            nodes: true,
            projectArtifacts: true,
          },
        },
      },
    });

    return NextResponse.json({ session: serializeSession(draft) }, { status: 201 });
  } catch (error) {
    if (isProjectAccessError(error)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    throw error;
  }
}
