"use client";

import { useState, useEffect, useCallback } from "react";

export interface StockQuote {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

export interface KlinePoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  changePercent: number;
}

export function useStockQuotes(codes: string[]) {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (codes.length === 0) return;
    try {
      const res = await fetch(`/api/stocks/quote?codes=${codes.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setQuotes(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { quotes, loading, error, refresh };
}

export function useStockKline(code: string, period = "daily", days = 90) {
  const [kline, setKline] = useState<KlinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function fetchKline() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/kline?code=${code}&period=${period}&days=${days}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (!cancelled) {
          setKline(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchKline();
    return () => { cancelled = true; };
  }, [code, period, days]);

  return { kline, loading, error };
}
