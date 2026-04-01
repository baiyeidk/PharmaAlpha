import { NextResponse } from "next/server";
import { StockSDK } from "stock-sdk";

const sdk = new StockSDK();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const period = (searchParams.get("period") || "daily") as "daily" | "weekly" | "monthly";
  const days = parseInt(searchParams.get("days") || "90", 10);

  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

    const klines = await sdk.getHistoryKline(code, {
      period,
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      adjust: "qfq",
    });

    return NextResponse.json(klines, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    console.error("Stock kline error:", e);
    return NextResponse.json({ error: "Failed to fetch kline data" }, { status: 500 });
  }
}
