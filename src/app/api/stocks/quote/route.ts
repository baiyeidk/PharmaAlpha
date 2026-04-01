import { NextResponse } from "next/server";
import { StockSDK } from "stock-sdk";

const sdk = new StockSDK();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codes = searchParams.get("codes");

  if (!codes) {
    return NextResponse.json({ error: "Missing codes parameter" }, { status: 400 });
  }

  try {
    const codeList = codes.split(",").map((c) => c.trim()).filter(Boolean);
    const quotes = await sdk.getSimpleQuotes(codeList);
    return NextResponse.json(quotes, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
    });
  } catch (e) {
    console.error("Stock quote error:", e);
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}
