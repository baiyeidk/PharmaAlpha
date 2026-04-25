import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  assertEmployeeProjectAccess,
  isProjectAccessError,
} from "@/lib/employee-investment";
import { serializeProject } from "@/lib/employee-investment/serializers";

export const runtime = "nodejs";

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
  const memberEmployeeCodes = Array.isArray(body.memberEmployeeCodes)
    ? body.memberEmployeeCodes.filter((code: unknown): code is string => typeof code === "string")
    : [];
  const memberEmployeeProfileIds = Array.isArray(body.memberEmployeeProfileIds)
    ? body.memberEmployeeProfileIds.filter((id: unknown): id is string => typeof id === "string")
    : [];

  if (!memberEmployeeCodes.length && !memberEmployeeProfileIds.length) {
    return NextResponse.json({ error: "memberEmployeeCodes is required" }, { status: 400 });
  }

  try {
    await assertEmployeeProjectAccess(session, projectId);

    const profileFilters = [
      memberEmployeeCodes.length ? { employeeCode: { in: memberEmployeeCodes } } : null,
      memberEmployeeProfileIds.length ? { id: { in: memberEmployeeProfileIds } } : null,
    ].filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));

    const profiles = await prisma.employeeProfile.findMany({
      where: { OR: profileFilters },
      select: { id: true },
    });

    if (!profiles.length) {
      return NextResponse.json({ error: "No matching employees found" }, { status: 404 });
    }

    await prisma.$transaction(
      profiles.map((profile) =>
        prisma.investmentProjectMember.upsert({
          where: {
            investmentProjectId_employeeProfileId: {
              investmentProjectId: projectId,
              employeeProfileId: profile.id,
            },
          },
          create: {
            investmentProjectId: projectId,
            employeeProfileId: profile.id,
            role: "member",
            status: "active",
          },
          update: {
            role: "member",
            status: "active",
          },
        })
      )
    );

    const project = await prisma.investmentProject.findUniqueOrThrow({
      where: { id: projectId },
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

    return NextResponse.json({ project: serializeProject(project) });
  } catch (error) {
    if (isProjectAccessError(error)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    throw error;
  }
}
