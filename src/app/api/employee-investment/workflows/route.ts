import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { invokeEmployeeInvestmentAgent } from "@/lib/employee-investment";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await invokeEmployeeInvestmentAgent<{ drafts?: unknown[] }>(
    session,
    {
      action: "list_workflows",
      messages: [],
    }
  );

  return NextResponse.json({
    workflows: result.metadata?.drafts ?? [],
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic, selectedSkills, selectedTeamMembers } = await req.json();
  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  const result = await invokeEmployeeInvestmentAgent(session, {
    action: "create_workflow",
    messages: [{ role: "user", content: topic }],
    params: {
      topic,
      selected_skills: selectedSkills,
      selected_team_members: selectedTeamMembers,
    },
  });

  return NextResponse.json(
    {
      message: result.text,
      workflow: result.metadata,
    },
    { status: 201 }
  );
}
