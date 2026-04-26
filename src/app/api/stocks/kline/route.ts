import { NextResponse } from "next/server";
import { StockSDK } from "stock-sdk";

const SCALE_MAP: Record<string, number> = {
  daily: 240,
  weekly: 1200,
  monthly: 7200,
};
const PERIOD_MAP: Record<string, "daily" | "weekly" | "monthly"> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
};
const LOOKBACK_MULTIPLIER: Record<string, number> = {
  daily: 2,
  weekly: 10,
  monthly: 35,
};

const sdk = new StockSDK();

interface SinaKline {
  day: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface SdkKline {
  date: string;
  open?: number | null;
  close?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  amount?: number | null;
  changePercent?: number | null;
}

function normalizeCode(code: string): string {
  const trimmed = code.trim();
  const m = trimmed.match(/^(?:sh|sz|bj)(\d{6})$/i);
  return m ? m[1] : trimmed;
}

function compactDateFromOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function parseNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapSdkKlines(rows: SdkKline[], days: number) {
  const sliced = rows.slice(-Math.max(days, 1));
  return sliced.map((row, i) => {
    const close = parseNumber(row.close);
    const prevClose = i > 0 ? parseNumber(sliced[i - 1]?.close) : close;
    const inferredChange = prevClose !== 0 ? ((close - prevClose) / prevClose) * 100 : 0;
    const changePercent = Number.isFinite(row.changePercent as number)
      ? parseNumber(row.changePercent)
      : inferredChange;

    return {
      date: row.date,
      open: parseNumber(row.open),
      close,
      high: parseNumber(row.high),
      low: parseNumber(row.low),
      volume: parseNumber(row.volume),
      amount: parseNumber(row.amount),
      changePercent: Math.round(changePercent * 100) / 100,
    };
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const period = searchParams.get("period") || "daily";
  const days = parseInt(searchParams.get("days") || "90", 10);

  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  const normalizedCode = normalizeCode(code);
  const sdkPeriod = PERIOD_MAP[period] ?? "daily";

  try {
    const lookbackDays = Math.max(days * (LOOKBACK_MULTIPLIER[sdkPeriod] ?? 2), 60);
    const startDate = compactDateFromOffset(lookbackDays);
    const raw = await sdk.getHistoryKline(normalizedCode, {
      period: sdkPeriod,
      startDate,
    });

    if (Array.isArray(raw) && raw.length > 0) {
      const klines = mapSdkKlines(raw as SdkKline[], days).filter((x) => x.date);
      if (klines.length > 0) {
        return NextResponse.json(klines, {
          headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
        });
      }
    }
  } catch (e) {
    console.warn("Stock kline sdk fallback to sina:", e);
  }

  let symbol = normalizedCode;
  if (/^\d{6}$/.test(normalizedCode)) {
    symbol = normalizedCode.startsWith("6") || normalizedCode.startsWith("9") || normalizedCode.startsWith("5")
      ? `sh${normalizedCode}`
      : `sz${normalizedCode}`;
  }
  const scale = SCALE_MAP[sdkPeriod] ?? 240;
  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${symbol}&scale=${scale}&ma=no&datalen=${days}`;

  try {
    const res = await fetch(url, { headers: { Referer: "https://finance.sina.com.cn" } });
    if (!res.ok) throw new Error(`Sina API responded with ${res.status}`);

    const raw: SinaKline[] | null = await res.json();

    if (!raw || !Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "public, s-maxage=60" },
      });
    }

    const klines = raw.map((k, i) => {
      const close = parseFloat(k.close);
      const prevClose = i > 0 ? parseFloat(raw[i - 1].close) : close;
      const changePercent = prevClose !== 0 ? ((close - prevClose) / prevClose) * 100 : 0;

      return {
        date: k.day,
        open: parseFloat(k.open),
        close,
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        volume: parseInt(k.volume, 10),
        amount: 0,
        changePercent: Math.round(changePercent * 100) / 100,
      };
    });

    return NextResponse.json(klines, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    console.error("Stock kline error:", e);
    return NextResponse.json({ error: "Failed to fetch kline data" }, { status: 500 });
  }
}
