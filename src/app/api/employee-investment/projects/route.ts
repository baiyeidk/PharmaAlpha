import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createProjectCode,
  ensureEmployeeContext,
  isEmployeeProjectAccessOpen,
} from "@/lib/employee-investment";
import { serializeProject } from "@/lib/employee-investment/serializers";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employee = await ensureEmployeeContext(session);
  const projects = await prisma.investmentProject.findMany({
    where: isEmployeeProjectAccessOpen()
      ? {}
      : {
          members: {
            some: {
              employeeProfileId: employee.profileId,
              status: "active",
            },
          },
        },
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        where: { status: "active" },
        orderBy: [{ isInitiator: "desc" }, { joinedAt: "asc" }],
        include: {
          employeeProfile: {
            select: {
              id: true,
              employeeCode: true,
              displayName: true,
              title: true,
              department: true,
              focusAreas: true,
              tags: true,
            },
          },
        },
      },
      conversations: {
        where: { conversationType: "project_main" },
        select: {
          id: true,
          title: true,
          conversationType: true,
          updatedAt: true,
        },
      },
      _count: {
        select: {
          artifacts: true,
          workflowDrafts: true,
        },
      },
    },
  });

  return NextResponse.json({
    projects: projects.map(serializeProject),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const title = String(body.title || "").trim();
  const topic = String(body.topic || title).trim();
  const objective = body.objective ? String(body.objective) : null;
  const priority = body.priority ? String(body.priority) : null;
  const memberEmployeeCodes = Array.isArray(body.memberEmployeeCodes)
    ? body.memberEmployeeCodes.filter((code: unknown): code is string => typeof code === "string")
    : [];

  if (!title || !topic) {
    return NextResponse.json({ error: "title and topic are required" }, { status: 400 });
  }

  const employee = await ensureEmployeeContext(session);
  const invitedProfiles = memberEmployeeCodes.length
    ? await prisma.employeeProfile.findMany({
        where: {
          employeeCode: {
            in: memberEmployeeCodes,
          },
        },
        select: { id: true },
      })
    : [];

  const project = await prisma.$transaction(async (tx) => {
    const createdProject = await tx.investmentProject.create({
      data: {
        employeeProfileId: employee.profileId,
        projectCode: createProjectCode(),
        title,
        topic,
        objective,
        priority,
        status: "active",
        members: {
          create: [
            {
              employeeProfileId: employee.profileId,
              role: "owner",
              isInitiator: true,
              status: "active",
            },
            ...invitedProfiles
              .filter((profile) => profile.id !== employee.profileId)
              .map((profile) => ({
                employeeProfileId: profile.id,
                role: "member",
                status: "active",
              })),
          ],
        },
      },
    });

    await tx.conversation.create({
      data: {
        userId: session.id,
        investmentProjectId: createdProject.id,
        conversationType: "project_main",
        title,
      },
    });

    return tx.investmentProject.findUniqueOrThrow({
      where: { id: createdProject.id },
      include: {
        members: {
          orderBy: [{ isInitiator: "desc" }, { joinedAt: "asc" }],
          include: {
            employeeProfile: {
              select: {
                id: true,
                employeeCode: true,
                displayName: true,
                title: true,
                department: true,
                focusAreas: true,
                tags: true,
              },
            },
          },
        },
        conversations: {
          where: { conversationType: "project_main" },
          select: {
            id: true,
            title: true,
            conversationType: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            artifacts: true,
            workflowDrafts: true,
          },
        },
      },
    });
  });

  return NextResponse.json({ project: serializeProject(project) }, { status: 201 });
}
