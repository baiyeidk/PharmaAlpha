import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureEmployeeContext } from "@/lib/employee-investment";

export const runtime = "nodejs";

function parseJsonConfig(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") {
    return JSON.parse(value) as Prisma.InputJsonValue;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ skillId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employee = await ensureEmployeeContext(session);
  const { skillId } = await params;
  const skill = await prisma.skillDefinition.findFirst({
    where: {
      id: skillId,
      employeeProfileId: employee.profileId,
      enabled: true,
    },
    select: { id: true },
  });
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const body = await req.json();
  const name = String(body.name || "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const isDefault = Boolean(body.isDefault);

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const sop = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.skillSop.updateMany({
          where: { skillDefinitionId: skillId },
          data: { isDefault: false },
        });
      }
      return tx.skillSop.create({
        data: {
          skillDefinitionId: skillId,
          name,
          description,
          config: parseJsonConfig(body.config),
          isDefault,
        },
      });
    });

    return NextResponse.json({ sop }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "SOP name already exists for this skill" },
        { status: 409 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON config" }, { status: 400 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
