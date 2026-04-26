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

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employee = await ensureEmployeeContext(session);
  const skills = await prisma.skillDefinition.findMany({
    where: { employeeProfileId: employee.profileId, enabled: true },
    orderBy: { createdAt: "asc" },
    include: {
      sops: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
      scripts: {
        where: { isActive: true },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  return NextResponse.json({ employee, skills });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employee = await ensureEmployeeContext(session);
  const body = await req.json();
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const category = body.category ? String(body.category).trim() : null;
  const mergeMode = body.mergeMode ? String(body.mergeMode).trim() : "parallel";
  const defaultSop = body.defaultSop && typeof body.defaultSop === "object" ? body.defaultSop : null;

  if (!name || !description) {
    return NextResponse.json({ error: "name and description are required" }, { status: 400 });
  }

  try {
    const skill = await prisma.skillDefinition.create({
      data: {
        employeeProfileId: employee.profileId,
        name,
        description,
        category,
        mergeMode,
        enabled: true,
        metadata: parseJsonConfig(body.metadata),
        sops: defaultSop
          ? {
              create: {
                name: String(defaultSop.name || `${name} SOP`).trim(),
                description: defaultSop.description
                  ? String(defaultSop.description).trim()
                  : null,
                config: parseJsonConfig(defaultSop.config),
                isDefault: true,
              },
            }
          : undefined,
      },
      include: {
        sops: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        },
        scripts: {
          where: { isActive: true },
          orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Skill name already exists for your employee profile" },
        { status: 409 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON config" }, { status: 400 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
