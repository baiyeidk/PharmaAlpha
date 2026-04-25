import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  console.info("[api/auth/session] request received");
  const session = await getSession();
  if (!session) {
    console.warn("[api/auth/session] unauthorized");
    return NextResponse.json({ user: null }, { status: 401 });
  }
  console.info(`[api/auth/session] ok user=${session.id}`);
  return NextResponse.json({ user: session });
}
