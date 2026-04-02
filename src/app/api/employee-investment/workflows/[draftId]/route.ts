import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { invokeEmployeeInvestmentAgent } from "@/lib/employee-investment";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { draftId } = await params;
  const result = await invokeEmployeeInvestmentAgent<{ drafts?: Array<Record<string, unknown>> }>(
    session,
    {
      action: "list_workflows",
      messages: [],
    }
  );

  const workflow =
    result.metadata?.drafts?.find((item) => item?.draft_id === draftId) ?? null;

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json(workflow);
}
