import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { invokeEmployeeInvestmentAgent } from "@/lib/employee-investment";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ draftId: string; nodeId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { draftId, nodeId } = await params;
  const updates = await req.json();

  const result = await invokeEmployeeInvestmentAgent(session, {
    action: "update_node",
    messages: [],
    params: {
      draft_id: draftId,
      node_id: nodeId,
      updates,
    },
  });

  return NextResponse.json({
    message: result.text,
    workflow: result.metadata,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ draftId: string; nodeId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { draftId, nodeId } = await params;
  const result = await invokeEmployeeInvestmentAgent(session, {
    action: "delete_node",
    messages: [],
    params: {
      draft_id: draftId,
      node_id: nodeId,
    },
  });

  return NextResponse.json({
    message: result.text,
    workflow: result.metadata,
  });
}
