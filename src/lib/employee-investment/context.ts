import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import type { EmployeeContext } from "./types";

function toEmployeeCode(session: SessionUser) {
  const base =
    session.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
    "employee";
  return `${base}-${session.id.slice(0, 8)}`;
}

export async function ensureEmployeeContext(
  session: SessionUser
): Promise<EmployeeContext> {
  const employeeCode = toEmployeeCode(session);

  const profile = await prisma.employeeProfile.upsert({
    where: { userId: session.id },
    update: {
      displayName: session.name || employeeCode,
    },
    create: {
      userId: session.id,
      employeeCode,
      displayName: session.name || employeeCode,
      title: "Investment Researcher",
      department: "Investment Research",
      focusAreas: ["biotech", "innovative_drugs"],
      tags: ["research"],
      socialAccounts: {
        create: {
          platform: "internal",
          accountRef: session.email || session.id,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      userId: true,
      employeeCode: true,
    },
  });

  return {
    userId: profile.userId,
    employeeCode: profile.employeeCode,
    profileId: profile.id,
  };
}
