import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureEmployeeContext } from "@/lib/employee-investment";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employee = await ensureEmployeeContext(session);
  const profile = await prisma.employeeProfile.findUnique({
    where: { id: employee.profileId },
    include: {
      socialAccounts: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
      observations: {
        orderBy: { observedAt: "desc" },
        take: 8,
      },
      investmentBehaviors: {
        orderBy: { decidedAt: "desc" },
        take: 8,
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
  });

  return NextResponse.json({
    employee,
    profile,
  });
}
