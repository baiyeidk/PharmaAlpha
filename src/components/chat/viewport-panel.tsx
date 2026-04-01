"use client";

import {
  X,
  Monitor,
  HeartPulse,
  HeartCrack,
  FileText,
  ImageIcon,
  Scan,
  Stethoscope,
  Pill,
  Thermometer,
  Activity,
  Wind,
  Droplets,
} from "lucide-react";
import { useViewportStore, type ViewportItem } from "@/stores/viewport-store";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* 板块心电 */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Stethoscope className="h-5 w-5 text-scrub" />
            <span className="font-mono text-sm tracking-widest text-scrub">板块心跳</span>
          </div>
          <div className="border border-border bg-card">
            <ECGCanvas condition="healthy" color="oklch(0.42 0.14 160)" height={64} speed={2} />
          </div>
        </div>

        {/* 跟踪企业 */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Activity className="h-5 w-5 text-vitals-amber" />
            <span className="font-mono text-sm tracking-widest text-vitals-amber">重点跟踪</span>
          </div>
          <div className="space-y-2">
            {wardPatients.map((p) => (
              <CompanyVitalsCard key={p.ticker} data={p} compact />
            ))}
          </div>
        </div>

        {/* 指标说明 */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Pill className="h-5 w-5 text-muted-foreground" />
            <span className="font-mono text-sm tracking-widest text-muted-foreground">指标说明</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-vitals-green" /> 营收 = 收入增长趋势</div>
            <div className="flex items-center gap-2"><Droplets className="h-4 w-4 text-vitals-green" /> 市盈率 = 估值水平</div>
            <div className="flex items-center gap-2"><HeartPulse className="h-4 w-4 text-vitals-green" /> 管线 = 研发管线强度</div>
            <div className="flex items-center gap-2"><Wind className="h-4 w-4 text-vitals-green" /> 现金流 = 资金充裕度</div>
            <div className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-vitals-green" /> 情绪 = 市场热度</div>
            <div className="flex items-center gap-2"><HeartCrack className="h-4 w-4 text-vitals-red" /> = 健康恶化信号</div>
          </div>
        </div>
      </div>
    </ScrollArea>
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
    <div className="flex h-full flex-col p-6 gap-4">
      <div className="text-center">
        <p className="font-mono text-lg font-bold text-scrub">{item.title}</p>
        {item.metadata?.description != null && (
          <p className="mt-1 text-base text-muted-foreground">{String(item.metadata.description)}</p>
        )}
      </div>
      <div className="flex-1 min-h-0 border border-border bg-card relative">
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
        <div className="absolute inset-0 pointer-events-none bg-surgical-grid-fine opacity-20" />
      </div>
    </div>
  );
}

function ViewportContent({ item }: { item: ViewportItem }) {
  switch (item.type) {
    case "image":
      return (
        <div className="flex h-full items-center justify-center p-5 bg-surgical-grid-fine">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={item.title} className="max-h-full max-w-full rounded-sm border border-border object-contain" />
        </div>
      );
    case "pdf":
      return <iframe src={item.url} className="h-full w-full" title={item.title} />;
    case "chart":
      return <ChartContent item={item} />;
    case "text":
      return (
        <ScrollArea className="h-full">
          <div className="p-5 text-base font-mono leading-relaxed text-foreground whitespace-pre-wrap">{item.content}</div>
        </ScrollArea>
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
    <div className="flex h-full flex-col bg-card/20">
      {hasItems && items.length > 1 && (
        <div className="flex items-center gap-px overflow-x-auto border-b border-border bg-background px-2 py-1.5">
          {items.map((item) => {
            const Icon = typeIcons[item.type] || Monitor;
            return (
              <button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-sm px-3 py-1.5 font-mono text-sm tracking-wider transition-colors",
                  activeItemId === item.id
                    ? "bg-scrub/10 text-scrub border border-scrub/20"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.title}
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                  className="ml-1 p-1 hover:bg-vitals-red/10 hover:text-vitals-red rounded-sm"
                >
                  <X className="h-4 w-4" />
                </span>
              </button>
            );
          })}
          <button
            onClick={() => items.forEach((i) => removeItem(i.id))}
            className="ml-auto shrink-0 font-mono text-sm tracking-wider text-muted-foreground hover:text-vitals-red px-2 transition-colors"
          >
            清空
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeItem ? <ViewportContent item={activeItem} /> : <DiagnosticsOverview />}
      </div>

      {activeItem && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-sm text-muted-foreground">
          <span className="tracking-widest">{activeItem.type}</span>
          <span>{new Date(activeItem.createdAt).toLocaleTimeString("zh-CN")}</span>
        </div>
      )}
    </div>
  );
}
