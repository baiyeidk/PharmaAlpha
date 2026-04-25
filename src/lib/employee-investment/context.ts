import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
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
  const profileSelect = {
    id: true,
    userId: true,
    employeeCode: true,
  } as const;

  let profile;
  try {
    profile = await prisma.employeeProfile.upsert({
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
      select: profileSelect,
    });
  } catch (error) {
    // Concurrent first-login requests can race on unique userId.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      try {
        profile = await prisma.employeeProfile.update({
          where: { userId: session.id },
          data: { displayName: session.name || employeeCode },
          select: profileSelect,
        });
      } catch {
        profile = await prisma.employeeProfile.findUnique({
          where: { userId: session.id },
          select: profileSelect,
        });
      }

      if (!profile) {
        throw error;
      }
    } else {
      throw error;
    }
  }

  return {
    userId: profile.userId,
    employeeCode: profile.employeeCode,
    profileId: profile.id,
  };
}
