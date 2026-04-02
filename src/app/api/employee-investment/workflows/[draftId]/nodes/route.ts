import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { invokeEmployeeInvestmentAgent } from "@/lib/employee-investment";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { draftId } = await params;
  const body = await req.json();
  if (!body.nodeType) {
    return NextResponse.json({ error: "nodeType is required" }, { status: 400 });
  }

  const result = await invokeEmployeeInvestmentAgent(session, {
    action: "add_node",
    messages: [],
    params: {
      draft_id: draftId,
      node_type: body.nodeType,
      title: body.title,
      depends_on: body.dependsOn,
      skill_name: body.skillName,
      sop_name: body.sopName,
      node_params: body.params,
    },
  });

  return NextResponse.json({
    message: result.text,
    workflow: result.metadata,
  });
}
