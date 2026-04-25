import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  assertEmployeeProjectAccess,
  isProjectAccessError,
} from "@/lib/employee-investment";
import { serializeProject } from "@/lib/employee-investment/serializers";

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
    const project = await prisma.investmentProject.findUnique({
      where: { id: projectId },
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

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project: serializeProject(project) });
  } catch (error) {
    if (isProjectAccessError(error)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    throw error;
  }
}
