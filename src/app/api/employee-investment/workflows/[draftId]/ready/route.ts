import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { invokeEmployeeInvestmentAgent } from "@/lib/employee-investment";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { draftId } = await params;
  const result = await invokeEmployeeInvestmentAgent(session, {
    action: "mark_ready",
    messages: [],
    params: { draft_id: draftId },
  });

  return NextResponse.json({
    message: result.text,
    workflow: result.metadata,
  });
}
