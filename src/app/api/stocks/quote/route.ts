import { NextResponse } from "next/server";
import { StockSDK } from "stock-sdk";

const sdk = new StockSDK();

type Market = "a" | "hk" | "us";

function detectMarket(code: string): Market {
  const trimmed = code.trim();
  if (/^(?:sh|sz|bj)\d{6}$/i.test(trimmed) || /^\d{6}$/.test(trimmed)) return "a";
  if (/^\d{4,5}$/.test(trimmed) || /^\d{5}\.HK$/i.test(trimmed)) return "hk";
  return "us";
}

function normalizeASymbol(code: string): string {
  const trimmed = code.trim();
  if (/^(?:sh|sz|bj)\d{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^\d{6}$/.test(trimmed)) {
    return trimmed.startsWith("6") || trimmed.startsWith("9") || trimmed.startsWith("5")
      ? `sh${trimmed}`
      : `sz${trimmed}`;
  }
  return trimmed;
}

function normalizeHKSymbol(code: string): string {
  const trimmed = code.trim().replace(/\.HK$/i, "");
  if (/^\d+$/.test(trimmed)) return trimmed.padStart(5, "0");
  return trimmed;
}

function normalizeUSSymbol(code: string): string {
  return code.trim().toUpperCase().replace(/\.US$/i, "");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codes = searchParams.get("codes");

  if (!codes) {
    return NextResponse.json({ error: "Missing codes parameter" }, { status: 400 });
  }

  try {
    const rawCodes = codes.split(",").map((c) => c.trim()).filter(Boolean);
    const aCodes = rawCodes.filter((c) => detectMarket(c) === "a").map(normalizeASymbol);
    const hkCodes = rawCodes.filter((c) => detectMarket(c) === "hk").map(normalizeHKSymbol);
    const usCodes = rawCodes.filter((c) => detectMarket(c) === "us").map(normalizeUSSymbol);

    const [aQuotes, hkQuotes, usQuotes] = await Promise.all([
      aCodes.length ? sdk.getSimpleQuotes(aCodes) : Promise.resolve([]),
      hkCodes.length ? sdk.getHKQuotes(hkCodes) : Promise.resolve([]),
      usCodes.length ? sdk.getUSQuotes(usCodes) : Promise.resolve([]),
    ]);

    const quotes = [...aQuotes, ...hkQuotes, ...usQuotes];
    return NextResponse.json(quotes, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
    });
  } catch (e) {
    console.error("Stock quote error:", e);
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}
