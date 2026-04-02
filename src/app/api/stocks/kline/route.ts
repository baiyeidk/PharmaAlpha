import { NextResponse } from "next/server";

const SCALE_MAP: Record<string, number> = {
  daily: 240,
  weekly: 1200,
  monthly: 7200,
};

interface SinaKline {
  day: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const period = searchParams.get("period") || "daily";
  const days = parseInt(searchParams.get("days") || "90", 10);

  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  const scale = SCALE_MAP[period] ?? 240;
  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${code}&scale=${scale}&ma=no&datalen=${days}`;

  try {
    const res = await fetch(url, {
      headers: { "Referer": "https://finance.sina.com.cn" },
    });

    if (!res.ok) throw new Error(`Sina API responded with ${res.status}`);

    const raw: SinaKline[] = await res.json();

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
