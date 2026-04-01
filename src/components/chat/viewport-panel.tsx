"use client";

import {
  X,
  Monitor,
  TrendingUp,
  TrendingDown,
  FileText,
  ImageIcon,
} from "lucide-react";
import { useViewportStore, type ViewportItem } from "@/stores/viewport-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, typeof Monitor> = {
  image: ImageIcon,
  chart: TrendingUp,
  pdf: FileText,
  text: Monitor,
};

/* ── Mock market data for the default overview ───────────── */

const miniIndices = [
  { name: "S&P Pharma", ticker: "XPH", value: "2,847", change: "+1.24%", up: true },
  { name: "NBI Biotech", ticker: "NBI", value: "4,128", change: "-0.38%", up: false },
  { name: "XLV Health", ticker: "XLV", value: "89.42", change: "+0.82%", up: true },
];

const topMovers = [
  { ticker: "LLY", price: "$792.10", change: "+3.2%", up: true },
  { ticker: "BMY", price: "$51.83", change: "+2.8%", up: true },
  { ticker: "MRNA", price: "$142.30", change: "+2.1%", up: true },
  { ticker: "GILD", price: "$84.26", change: "-1.4%", up: false },
  { ticker: "BIIB", price: "$198.50", change: "-1.8%", up: false },
];

const miniNews = [
  { title: "Lilly GLP-1 agonist revenue +23% vs est.", time: "2h", up: true },
  { title: "FDA fast-tracks Pfizer mRNA oncology", time: "5h", up: true },
  { title: "Keytruda biosimilar competition nears", time: "8h", up: false },
];

function MarketOverview() {
  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Indices
          </span>
          <div className="mt-1.5 space-y-1">
            {miniIndices.map((idx) => (
              <div
                key={idx.ticker}
                className="flex items-center justify-between rounded-md border border-border/20 bg-card/30 px-2.5 py-2"
              >
                <div>
                  <span className="block text-xs font-mono text-muted-foreground">
                    {idx.name}
                  </span>
                  <span className="block font-mono text-sm font-medium tabular-nums text-foreground">
                    {idx.value}
                  </span>
                </div>
                <span
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    idx.up ? "text-pa-green" : "text-pa-red"
                  )}
                >
                  {idx.up ? "▲" : "▽"} {idx.change}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Sector Performance
          </span>
          <div className="mt-1.5 rounded-md border border-border/20 bg-card/30 p-3">
            <svg viewBox="0 0 400 150" className="w-full" fill="none">
              <defs>
                <linearGradient id="vpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.47 0.14 195)" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="oklch(0.47 0.14 195)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 37.5, 75, 112.5, 150].map((y) => (
                <line
                  key={`h-${y}`}
                  x1="0" y1={y} x2="400" y2={y}
                  stroke="oklch(0.90 0.005 250)" strokeWidth="0.5" strokeDasharray="3 3"
                />
              ))}
              {[0, 80, 160, 240, 320, 400].map((x) => (
                <line
                  key={`v-${x}`}
                  x1={x} y1="0" x2={x} y2="150"
                  stroke="oklch(0.90 0.005 250)" strokeWidth="0.5" strokeDasharray="3 3"
                />
              ))}
              <path
                d="M0,150 L0,105 L40,100 L80,110 L120,85 L160,75 L200,65 L240,60 L280,55 L320,45 L360,40 L400,35 L400,150 Z"
                fill="url(#vpGrad)"
              />
              <polyline
                points="0,105 40,100 80,110 120,85 160,75 200,65 240,60 280,55 320,45 360,40 400,35"
                stroke="oklch(0.47 0.14 195)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="400" cy="35" r="3" fill="oklch(0.47 0.14 195)" />
            </svg>
            <div className="mt-2 flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>6 months</span>
              <span className="text-pa-green">+12.4% YTD</span>
            </div>
          </div>
        </div>

        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Top Movers
          </span>
          <div className="mt-1.5 rounded-md border border-border/20 bg-card/30 divide-y divide-border/15">
            {topMovers.map((m) => (
              <div key={m.ticker} className="flex items-center justify-between px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  {m.up ? (
                    <TrendingUp className="h-3 w-3 text-pa-green" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-pa-red" />
                  )}
                  <span className="font-mono text-sm font-medium text-foreground">
                    {m.ticker}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {m.price}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums w-14 text-right",
                      m.up ? "text-pa-green" : "text-pa-red"
                    )}
                  >
                    {m.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Headlines
          </span>
          <div className="mt-1.5 space-y-0">
            {miniNews.map((n, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5">
                <div
                  className={cn(
                    "mt-1 h-1 w-1 shrink-0 rounded-full",
                    n.up ? "bg-pa-green/40" : "bg-pa-red/40"
                  )}
                />
                <p className="min-w-0 flex-1 text-xs leading-snug text-foreground/80">
                  {n.title}
                </p>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {n.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

/* ── Viewport item content renderers ─────────────────────── */

function ViewportContent({ item }: { item: ViewportItem }) {
  switch (item.type) {
    case "image":
      return (
        <div className="flex h-full items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.title}
            className="max-h-full max-w-full rounded border border-border/30 object-contain"
          />
        </div>
      );
    case "pdf":
      return (
        <iframe src={item.url} className="h-full w-full" title={item.title} />
      );
    case "chart":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
          <div className="w-full">
            <svg viewBox="0 0 400 200" className="w-full" fill="none">
              <defs>
                <linearGradient id="chartGradItem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.47 0.14 195)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="oklch(0.47 0.14 195)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 50, 100, 150, 200].map((y) => (
                <line key={y} x1="0" y1={y} x2="400" y2={y}
                  stroke="oklch(0.90 0.005 250)" strokeWidth="0.5" strokeDasharray="3 3"
                />
              ))}
              <path
                d="M0,200 L0,140 L50,130 L100,145 L150,110 L200,100 L250,80 L300,85 L350,60 L400,55 L400,200 Z"
                fill="url(#chartGradItem)"
              />
              <polyline
                points="0,140 50,130 100,145 150,110 200,100 250,80 300,85 350,60 400,55"
                stroke="oklch(0.47 0.14 195)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="400" cy="55" r="4" fill="oklch(0.47 0.14 195)" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-mono text-sm text-pa-cyan">{item.title}</p>
            {item.metadata?.description != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {String(item.metadata.description)}
              </p>
            )}
          </div>
        </div>
      );
    case "text":
      return (
        <ScrollArea className="h-full">
          <div className="p-4 text-sm font-mono leading-relaxed text-foreground/80 whitespace-pre-wrap">
            {item.content}
          </div>
        </ScrollArea>
      );
    default:
      return <MarketOverview />;
  }
}

/* ── Main viewport panel ─────────────────────────────────── */

export function ViewportPanel() {
  const { items, activeItemId, setActiveItem, removeItem } = useViewportStore();
  const activeItem = items.find((i) => i.id === activeItemId);
  const hasItems = items.length > 0;

  return (
    <div className="flex h-full flex-col bg-card/20">
      <div className="flex h-10 items-center justify-between border-b border-border/40 px-3">
        <div className="flex items-center gap-2">
          <Monitor className="h-3.5 w-3.5 text-pa-amber" />
          <span className="font-mono text-xs font-medium uppercase tracking-wider text-pa-amber">
            Viewport
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hasItems && (
            <button
              onClick={() => {
                items.forEach((i) => removeItem(i.id));
              }}
              className="font-mono text-xs text-muted-foreground hover:text-muted-foreground px-1.5 py-0.5 rounded transition-colors"
            >
              Clear
            </button>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {hasItems ? `${items.length} item${items.length !== 1 ? "s" : ""}` : "Market"}
          </span>
        </div>
      </div>

      {hasItems && items.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border/30 px-2 py-1.5">
          {items.map((item) => {
            const Icon = typeIcons[item.type] || Monitor;
            return (
              <button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded px-2 py-1 font-mono text-xs transition-colors",
                  activeItemId === item.id
                    ? "bg-pa-cyan/10 text-pa-cyan"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
                {item.title}
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                  className="ml-1 rounded-sm p-0.5 hover:bg-pa-red/10 hover:text-pa-red"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeItem ? <ViewportContent item={activeItem} /> : <MarketOverview />}
      </div>

      {activeItem && (
        <div className="flex items-center justify-between border-t border-border/30 px-3 py-1.5">
          <span className="font-mono text-xs text-muted-foreground uppercase">
            {activeItem.type}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {new Date(activeItem.createdAt).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}
