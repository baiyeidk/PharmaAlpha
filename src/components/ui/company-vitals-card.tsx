"use client";

import { HeartPulse, HeartCrack } from "lucide-react";
import { ECGCanvas } from "./ecg-canvas";
import { MiniStockChart } from "./stock-chart";
import { useStockKline } from "@/hooks/use-stock-data";
import { cn } from "@/lib/utils";

export interface CompanyVitals {
  ticker: string;
  name: string;
  price: string;
  priceChange: string;
  priceUp: boolean;
  revenue: string;
  revenueStatus: "growing" | "stable" | "declining";
  pe: string;
  peStatus: "healthy" | "elevated" | "critical";
  pipeline: string;
  pipelineStatus: "strong" | "moderate" | "weak";
  cashflow: string;
  cashflowStatus: "positive" | "neutral" | "negative";
  sentiment: string;
  sentimentStatus: "warm" | "neutral" | "cold" | "fever";
  overallCondition: "healthy" | "irregular" | "critical";
  stockCode?: string;
}

function conditionColor(c: CompanyVitals["overallCondition"]): string {
  if (c === "healthy") return "#EF4444";
  if (c === "irregular") return "#F59E0B";
  return "#10B981";
}

function conditionLabel(c: CompanyVitals["overallCondition"]): string {
  if (c === "healthy") return "健康";
  if (c === "irregular") return "关注";
  return "预警";
}

function StockChartSection({ stockCode, overallCondition }: {
  stockCode?: string;
  overallCondition: CompanyVitals["overallCondition"];
}) {
  const { kline, loading } = useStockKline(stockCode || "", "daily", 90);

  if (!stockCode || loading || kline.length === 0) {
    return (
      <ECGCanvas
        condition={overallCondition}
        color={conditionColor(overallCondition)}
        height={48}
        speed={overallCondition === "critical" ? 3 : 2}
      />
    );
  }

  return <MiniStockChart data={kline} height={48} />;
}

interface Props {
  data: CompanyVitals;
  compact?: boolean;
  className?: string;
}

export function CompanyVitalsCard({ data, compact = false, className }: Props) {
  const d = data;

  return (
    <div className={cn(
      "rounded-xl overflow-hidden bg-white/60 border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md",
      className,
    )}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          {d.priceUp
            ? <HeartPulse className="h-5 w-5 text-vitals-green" />
            : <HeartCrack className="h-5 w-5 text-vitals-red" />
          }
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm font-bold text-foreground">{d.ticker}</span>
            <span className="text-xs text-muted-foreground">{d.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <div className="font-mono text-sm font-bold tabular-nums text-foreground">{d.price}</div>
            <div className={cn(
              "font-mono text-xs font-semibold tabular-nums",
              d.priceUp ? "text-vitals-green" : "text-vitals-red"
            )}>
              {d.priceChange}
            </div>
          </div>
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
            d.overallCondition === "healthy" && "text-vitals-green bg-vitals-green/8",
            d.overallCondition === "irregular" && "text-vitals-amber bg-vitals-amber/8",
            d.overallCondition === "critical" && "text-vitals-red bg-vitals-red/8 animate-vitals-blink",
          )}>
            {conditionLabel(d.overallCondition)}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="px-1">
          <StockChartSection
            stockCode={d.stockCode}
            overallCondition={d.overallCondition}
          />
        </div>
      )}
    </div>
  );
}
