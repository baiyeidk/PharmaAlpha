import { NextResponse } from "next/server";
import { StockSDK } from "stock-sdk";

const sdk = new StockSDK();

function normalizeSymbol(code: string): string {
  const trimmed = code.trim();
  if (/^(?:sh|sz|bj)\d{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^\d{6}$/.test(trimmed)) {
    return trimmed.startsWith("6") || trimmed.startsWith("9") || trimmed.startsWith("5")
      ? `sh${trimmed}`
      : `sz${trimmed}`;
  }
  return trimmed;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codes = searchParams.get("codes");

  if (!codes) {
    return NextResponse.json({ error: "Missing codes parameter" }, { status: 400 });
  }

  try {
    const codeList = codes
      .split(",")
      .map((c) => normalizeSymbol(c))
      .filter(Boolean);
    const quotes = await sdk.getSimpleQuotes(codeList);
    return NextResponse.json(quotes, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
    });
  } catch (e) {
    console.error("Stock quote error:", e);
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}
