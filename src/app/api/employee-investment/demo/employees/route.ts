import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employees = await prisma.employeeProfile.findMany({
    where: {
      employeeCode: {
        startsWith: "demo-",
      },
    },
    include: {
      socialAccounts: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
      observations: {
        orderBy: { observedAt: "desc" },
        take: 5,
      },
      investmentBehaviors: {
        orderBy: { decidedAt: "desc" },
        take: 5,
      },
      skills: {
        where: { enabled: true },
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
      },
    },
    orderBy: { employeeCode: "asc" },
  });

  return NextResponse.json({
    employees,
  });
}
