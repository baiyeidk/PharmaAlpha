"use client";

import {
  X,
  Monitor,
  HeartPulse,
  HeartCrack,
  FileText,
  ImageIcon,
  Pill,
  Thermometer,
  Activity,
} from "lucide-react";
import { useViewportStore, type ViewportItem } from "@/stores/viewport-store";
import { ECGCanvas } from "@/components/ui/ecg-canvas";
import { StockChart } from "@/components/ui/stock-chart";
import { useStockKline } from "@/hooks/use-stock-data";
import { CompanyVitalsCard, type CompanyVitals } from "@/components/ui/company-vitals-card";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, typeof Monitor> = {
  image: ImageIcon,
  chart: HeartPulse,
  pdf: FileText,
  text: Monitor,
};

const wardPatients: CompanyVitals[] = [
  {
    ticker: "600276", name: "恒瑞医药", price: "¥48.32", priceChange: "+3.2%", priceUp: true,
    revenue: "+18%", revenueStatus: "growing", pe: "42.5x", peStatus: "elevated",
    pipeline: "12 期III", pipelineStatus: "strong", cashflow: "+¥28亿", cashflowStatus: "positive",
    sentiment: "99.1°", sentimentStatus: "fever", overallCondition: "healthy", stockCode: "sh600276",
  },
  {
    ticker: "603259", name: "药明康德", price: "¥62.15", priceChange: "-1.8%", priceUp: false,
    revenue: "-8%", revenueStatus: "declining", pe: "25.3x", peStatus: "healthy",
    pipeline: "CRO龙头", pipelineStatus: "strong", cashflow: "+¥15亿", cashflowStatus: "positive",
    sentiment: "96.4°", sentimentStatus: "cold", overallCondition: "irregular", stockCode: "sh603259",
  },
  {
    ticker: "688235", name: "百济神州", price: "¥142.30", priceChange: "-4.1%", priceUp: false,
    revenue: "-15%", revenueStatus: "declining", pe: "亏损", peStatus: "critical",
    pipeline: "6 期III", pipelineStatus: "moderate", cashflow: "-¥8亿", cashflowStatus: "negative",
    sentiment: "102.8°", sentimentStatus: "fever", overallCondition: "critical", stockCode: "sh688235",
  },
];

function DiagnosticsOverview() {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-4 w-4 text-foreground/70" />
        <span className="text-sm font-semibold text-foreground">重点跟踪</span>
      </div>
      <div className="space-y-2.5">
        {wardPatients.map((p) => (
          <CompanyVitalsCard key={p.ticker} data={p} compact />
        ))}
      </div>

      <div className="flex items-center gap-2 mt-4 mb-1">
        <Pill className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">指标说明</span>
      </div>
      <div className="grid grid-cols-1 gap-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2"><HeartPulse className="h-3 w-3 text-vitals-green" /> 红心 = 价格上涨</div>
        <div className="flex items-center gap-2"><HeartCrack className="h-3 w-3 text-vitals-red" /> 碎心 = 价格下跌</div>
        <div className="flex items-center gap-2"><Thermometer className="h-3 w-3 text-vitals-amber" /> 温度 = 市场热度</div>
      </div>
    </div>
  );
}

function tickerToCode(ticker: string): string {
  if (ticker.startsWith("sh") || ticker.startsWith("sz")) return ticker;
  const code = ticker.replace(/\D/g, "");
  if (!code) return "";
  if (code.startsWith("6")) return `sh${code}`;
  return `sz${code}`;
}

function ChartContent({ item }: { item: ViewportItem }) {
  const tickers = (item.metadata?.tickers as string[]) || [];
  const firstTicker = tickers[0] || "";
  const code = tickerToCode(firstTicker);
  const { kline, loading } = useStockKline(code, "daily", 90);

  return (
    <div className="flex h-full flex-col p-5 gap-4">
      <div>
        <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
        {item.metadata?.description != null && (
          <p className="mt-1 text-xs text-muted-foreground">{String(item.metadata.description)}</p>
        )}
      </div>
      <div className="flex-1 min-h-0 rounded-lg bg-black/[0.02] border border-black/[0.04] overflow-hidden">
        {loading || kline.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <ECGCanvas condition="healthy" color="oklch(0.42 0.14 160)" height={200} speed={2} lineWidth={2} />
          </div>
        ) : (
          <StockChart
            data={kline}
            height={300}
            showGrid={true}
            showTime={true}
            showPrice={true}
            showCrosshair={true}
          />
        )}
      </div>
    </div>
  );
}

function ViewportContent({ item }: { item: ViewportItem }) {
  switch (item.type) {
    case "image":
      return (
        <div className="flex h-full items-center justify-center p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={item.title} className="max-h-full max-w-full rounded-xl object-contain shadow-md" />
        </div>
      );
    case "pdf":
      return <iframe src={item.url} className="h-full w-full" title={item.title} />;
    case "chart":
      return <ChartContent item={item} />;
    case "text":
      return (
        <div className="h-full overflow-y-auto p-5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">{item.content}</div>
      );
    default:
      return <DiagnosticsOverview />;
  }
}

export function ViewportPanel() {
  const { items, activeItemId, setActiveItem, removeItem } = useViewportStore();
  const activeItem = items.find((i) => i.id === activeItemId);
  const hasItems = items.length > 0;

  return (
    <div className="flex h-full flex-col">
      {hasItems && items.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-black/[0.04] px-3 py-1.5">
          {items.map((item) => {
            const Icon = typeIcons[item.type] || Monitor;
            return (
              <button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
                  activeItemId === item.id
                    ? "bg-scrub/10 text-scrub font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/[0.03]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="max-w-[100px] truncate">{item.title}</span>
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                  className="ml-0.5 p-0.5 hover:bg-vitals-red/10 hover:text-vitals-red rounded-md"
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            );
          })}
          <button
            onClick={() => items.forEach((i) => removeItem(i.id))}
            className="ml-auto shrink-0 text-[10px] text-muted-foreground hover:text-vitals-red px-2 transition-colors"
          >
            清空
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeItem ? <ViewportContent item={activeItem} /> : <DiagnosticsOverview />}
      </div>

      {activeItem && (
        <div className="flex items-center justify-between border-t border-black/[0.04] px-4 py-2 text-[10px] text-muted-foreground">
          <span>{activeItem.type.toUpperCase()}</span>
          <span>{new Date(activeItem.createdAt).toLocaleTimeString("zh-CN")}</span>
        </div>
      )}
    </div>
  );
}
