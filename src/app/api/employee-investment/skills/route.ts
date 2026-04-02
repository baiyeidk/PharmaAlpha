import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { invokeEmployeeInvestmentAgent } from "@/lib/employee-investment";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await invokeEmployeeInvestmentAgent<{ skills?: unknown[] }>(
    session,
    {
      action: "list_skills",
      messages: [],
    }
  );

  return NextResponse.json({
    skills: result.metadata?.skills ?? [],
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, metadata } = await req.json();
  if (!name || !description) {
    return NextResponse.json(
      { error: "name and description are required" },
      { status: 400 }
    );
  }

  const result = await invokeEmployeeInvestmentAgent(session, {
    action: "register_skill",
    messages: [],
    params: {
      name,
      description,
      metadata,
    },
  });

  return NextResponse.json(
    {
      message: result.text,
      skill: result.metadata,
    },
    { status: 201 }
  );
}
