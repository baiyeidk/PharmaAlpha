"use client";

import { HeartPulse, HeartCrack, Activity, Thermometer, Wind, Droplets } from "lucide-react";
import { ECGCanvas } from "./ecg-canvas";
import { MiniStockChart } from "./stock-chart";
import { useStockKline, type KlinePoint } from "@/hooks/use-stock-data";
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

function VitalRow({
  label,
  value,
  status,
  icon: Icon,
}: {
  label: string;
  value: string;
  status: "good" | "warn" | "bad";
  icon: typeof Activity;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className={cn(
        "h-5 w-5 shrink-0",
        status === "good" && "text-vitals-green",
        status === "warn" && "text-vitals-amber",
        status === "bad" && "text-vitals-red",
      )} />
      <span className="font-mono text-xs tracking-widest text-muted-foreground w-14">{label}</span>
      <span className={cn(
        "font-mono text-base font-semibold tabular-nums",
        status === "good" && "text-vitals-green",
        status === "warn" && "text-vitals-amber",
        status === "bad" && "text-vitals-red",
      )}>
        {value}
      </span>
    </div>
  );
}

function statusToLevel(s: string): "good" | "warn" | "bad" {
  if (["growing", "healthy", "strong", "positive", "warm"].includes(s)) return "good";
  if (["stable", "moderate", "neutral"].includes(s)) return "warn";
  return "bad";
}

function conditionColor(c: CompanyVitals["overallCondition"]): string {
  if (c === "healthy") return "oklch(0.48 0.20 25)";
  if (c === "irregular") return "oklch(0.50 0.14 80)";
  return "oklch(0.40 0.16 150)";
}

function conditionLabel(c: CompanyVitals["overallCondition"]): string {
  if (c === "healthy") return "健康";
  if (c === "irregular") return "关注";
  return "预警";
}

function StockChartSection({ stockCode, compact, overallCondition }: {
  stockCode?: string;
  compact: boolean;
  overallCondition: CompanyVitals["overallCondition"];
}) {
  const { kline, loading } = useStockKline(stockCode || "", "daily", 90);
  const chartHeight = compact ? 48 : 64;

  if (!stockCode || loading || kline.length === 0) {
    return (
      <ECGCanvas
        condition={overallCondition}
        color={conditionColor(overallCondition)}
        height={chartHeight}
        speed={overallCondition === "critical" ? 3 : 2}
      />
    );
  }

  return <MiniStockChart data={kline} height={chartHeight} />;
}

interface Props {
  data: CompanyVitals;
  compact?: boolean;
  className?: string;
}

export function CompanyVitalsCard({ data, compact = false, className }: Props) {
  const d = data;

  return (
    <div className={cn("border border-border bg-card/50 overflow-hidden", className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          {d.priceUp
            ? <HeartPulse className="h-7 w-7 text-vitals-green" />
            : <HeartCrack className="h-7 w-7 text-vitals-red" />
          }
          <span className="font-mono text-lg font-bold text-foreground">{d.ticker}</span>
          <span className="text-sm text-muted-foreground">{d.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold tabular-nums text-foreground">{d.price}</span>
          <span className={cn(
            "font-mono text-base font-semibold tabular-nums",
            d.priceUp ? "text-vitals-green" : "text-vitals-red"
          )}>
            {d.priceChange}
          </span>
          <span className={cn(
            "font-mono text-xs tracking-widest px-2 py-1 rounded-sm border",
            d.overallCondition === "healthy" && "text-vitals-green border-vitals-green/30 bg-vitals-green/5",
            d.overallCondition === "irregular" && "text-vitals-amber border-vitals-amber/30 bg-vitals-amber/5",
            d.overallCondition === "critical" && "text-vitals-red border-vitals-red/30 bg-vitals-red/5 animate-vitals-blink",
          )}>
            {conditionLabel(d.overallCondition)}
          </span>
        </div>
      </div>

      {/* 股价走势（真实数据）或 ECG 动画（加载中/无数据时） */}
      <div className="border-b border-border/50 bg-background/30 relative">
        <StockChartSection
          stockCode={d.stockCode}
          compact={compact}
          overallCondition={d.overallCondition}
        />
        {/* ECG 心电监护仪网格叠加 */}
        <div className="absolute inset-0 pointer-events-none bg-surgical-grid-fine opacity-30" />
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-x-4 px-3 py-2">
          <VitalRow label="营收" value={d.revenue} status={statusToLevel(d.revenueStatus)} icon={Activity} />
          <VitalRow label="市盈率" value={d.pe} status={statusToLevel(d.peStatus)} icon={Droplets} />
          <VitalRow label="管线" value={d.pipeline} status={statusToLevel(d.pipelineStatus)} icon={HeartPulse} />
          <VitalRow label="现金流" value={d.cashflow} status={statusToLevel(d.cashflowStatus)} icon={Wind} />
          <VitalRow label="情绪" value={d.sentiment} status={statusToLevel(d.sentimentStatus)} icon={Thermometer} />
        </div>
      )}
    </div>
  );
}
