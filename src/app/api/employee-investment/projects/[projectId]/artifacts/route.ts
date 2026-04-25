import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  assertEmployeeProjectAccess,
  isProjectAccessError,
} from "@/lib/employee-investment";
import { serializeArtifact } from "@/lib/employee-investment/serializers";

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
    const artifacts = await prisma.projectArtifact.findMany({
      where: { investmentProjectId: projectId },
      orderBy: { updatedAt: "desc" },
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
    });

    return NextResponse.json({ artifacts: artifacts.map(serializeArtifact) });
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
  const artifactType = String(body.artifactType || "markdown").trim();
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  const inputArtifactIds = Array.isArray(body.inputArtifactIds) ? body.inputArtifactIds : [];

  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  try {
    const access = await assertEmployeeProjectAccess(session, projectId);
    const artifact = await prisma.projectArtifact.create({
      data: {
        investmentProjectId: projectId,
        createdByEmployeeProfileId: access.employee.profileId,
        artifactType,
        title,
        content,
        inputArtifactIds,
        attachments: body.attachments ?? undefined,
        metadata: body.metadata ?? undefined,
      },
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
    });

    return NextResponse.json({ artifact: serializeArtifact(artifact) }, { status: 201 });
  } catch (error) {
    if (isProjectAccessError(error)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    throw error;
  }
}
