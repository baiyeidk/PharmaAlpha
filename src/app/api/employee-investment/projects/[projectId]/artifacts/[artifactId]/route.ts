import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  assertEmployeeProjectAccess,
  isProjectAccessError,
} from "@/lib/employee-investment";
import { serializeArtifact } from "@/lib/employee-investment/serializers";

export const runtime = "nodejs";

async function getArtifactOr404(projectId: string, artifactId: string) {
  return prisma.projectArtifact.findFirst({
    where: {
      id: artifactId,
      investmentProjectId: projectId,
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
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string; artifactId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, artifactId } = await params;
  const body = await req.json();
  const title = body.title === undefined ? undefined : String(body.title).trim();
  const content = body.content === undefined ? undefined : String(body.content).trim();
  const artifactType =
    body.artifactType === undefined ? undefined : String(body.artifactType).trim();

  if (title === "" || content === "") {
    return NextResponse.json({ error: "title and content cannot be empty" }, { status: 400 });
  }

  try {
    await assertEmployeeProjectAccess(session, projectId);
    const existing = await getArtifactOr404(projectId, artifactId);
    if (!existing) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    const artifact = await prisma.projectArtifact.update({
      where: { id: artifactId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(artifactType !== undefined ? { artifactType } : {}),
        ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
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

    return NextResponse.json({ artifact: serializeArtifact(artifact) });
  } catch (error) {
    if (isProjectAccessError(error)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; artifactId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, artifactId } = await params;

  try {
    await assertEmployeeProjectAccess(session, projectId);
    const existing = await getArtifactOr404(projectId, artifactId);
    if (!existing) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    await prisma.projectArtifact.delete({
      where: { id: artifactId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isProjectAccessError(error)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    throw error;
  }
}
