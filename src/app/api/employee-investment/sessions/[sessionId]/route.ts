import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  assertEmployeeProjectAccess,
  isProjectAccessError,
} from "@/lib/employee-investment";
import { serializeArtifact, serializeSession } from "@/lib/employee-investment/serializers";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const draft = await prisma.workflowDraft.findUnique({
    where: { id: sessionId },
    include: {
      nodes: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      },
      skillDefinition: {
        select: { id: true, name: true, description: true },
      },
      skillSop: {
        select: { id: true, name: true, description: true },
      },
      executions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          summary: true,
          createdAt: true,
          finishedAt: true,
        },
      },
      projectArtifacts: {
        orderBy: { createdAt: "desc" },
        include: {
          createdByEmployeeProfile: {
            select: {
              id: true,
              employeeCode: true,
              displayName: true,
              title: true,
            },
          },
          skillDefinition: {
            select: { id: true, name: true, description: true },
          },
          skillSop: {
            select: { id: true, name: true, description: true },
          },
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

  if (!draft?.investmentProjectId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    await assertEmployeeProjectAccess(session, draft.investmentProjectId);
    return NextResponse.json({
      session: serializeSession(draft),
      nodes: draft.nodes,
      artifacts: draft.projectArtifacts.map(serializeArtifact),
    });
  } catch (error) {
    if (isProjectAccessError(error)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    throw error;
  }
}
