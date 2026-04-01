"use client";

import {
  Syringe,
  Crosshair,
  CalendarClock,
  FlaskConical,
  Stethoscope,
  Pill,
  HeartPulse,
  HeartCrack,
  ShieldCheck,
  ShieldAlert,
  Thermometer,
  FileText,
} from "lucide-react";
import { CompanyVitalsCard, type CompanyVitals } from "@/components/ui/company-vitals-card";
import { ECGCanvas } from "@/components/ui/ecg-canvas";
import { cn } from "@/lib/utils";

const patients: CompanyVitals[] = [
  {
    ticker: "600276", name: "恒瑞医药", price: "¥48.32", priceChange: "+3.2%", priceUp: true,
    revenue: "+18%", revenueStatus: "growing",
    pe: "42.5x", peStatus: "elevated",
    pipeline: "12 期III", pipelineStatus: "strong",
    cashflow: "+¥28亿", cashflowStatus: "positive",
    sentiment: "99.1°", sentimentStatus: "fever",
    overallCondition: "healthy", stockCode: "sh600276",
  },
  {
    ticker: "603259", name: "药明康德", price: "¥62.15", priceChange: "-1.8%", priceUp: false,
    revenue: "-8%", revenueStatus: "declining",
    pe: "25.3x", peStatus: "healthy",
    pipeline: "CRO龙头", pipelineStatus: "strong",
    cashflow: "+¥15亿", cashflowStatus: "positive",
    sentiment: "96.4°", sentimentStatus: "cold",
    overallCondition: "irregular", stockCode: "sh603259",
  },
  {
    ticker: "300760", name: "迈瑞医疗", price: "¥285.60", priceChange: "+1.8%", priceUp: true,
    revenue: "+20%", revenueStatus: "growing",
    pe: "35.8x", peStatus: "elevated",
    pipeline: "器械龙头", pipelineStatus: "strong",
    cashflow: "+¥42亿", cashflowStatus: "positive",
    sentiment: "98.6°", sentimentStatus: "warm",
    overallCondition: "healthy", stockCode: "sz300760",
  },
  {
    ticker: "688235", name: "百济神州", price: "¥142.30", priceChange: "-4.1%", priceUp: false,
    revenue: "-15%", revenueStatus: "declining",
    pe: "亏损", peStatus: "critical",
    pipeline: "6 期III", pipelineStatus: "moderate",
    cashflow: "-¥8亿", cashflowStatus: "negative",
    sentiment: "102.8°", sentimentStatus: "fever",
    overallCondition: "critical", stockCode: "sh688235",
  },
];

const procedures = [
  {
    icon: Syringe, code: "管线", label: "管线深度解剖",
    desc: "分析药企在研管线及临床进展",
    text: "深度分析恒瑞医药（600276）的在研药物管线，包括所有 III 期临床试验、成功概率、2026 年即将到来的审批节点和竞争格局。",
  },
  {
    icon: Crosshair, code: "对比", label: "企业健康对比",
    desc: "多维度横向对比两家企业",
    text: "横向对比药明康德（603259）和泰格医药（300347）：营收趋势、管线能力、估值水平、现金流健康度、客户集中度风险及整体投资逻辑。",
  },
  {
    icon: FileText, code: "财报", label: "财报病理分析",
    desc: "最新财报的深度拆解",
    text: "对迈瑞医疗（300760）进行深度财报分析：最新季度收入结构、利润率趋势、研发投入效率、负债水平、现金流质量以及海外业务占比。",
  },
  {
    icon: CalendarClock, code: "审批", label: "审批日历前瞻",
    desc: "NMPA/CDE 审批节点追踪",
    text: "本季度有哪些重要的 NMPA 审批节点和新药上市申请？包括潜在的收入影响、竞争格局分析和概率加权评估。",
  },
  {
    icon: FlaskConical, code: "行业", label: "行业全景解剖",
    desc: "医药行业宏观趋势报告",
    text: "给出中国医药行业全景分析：板块涨跌龙虎榜、集采政策影响、创新药出海进展、并购动态、资金流向及政策风向。",
  },
  {
    icon: Pill, code: "风险", label: "风险评估处方",
    desc: "投资风险多维度评估",
    text: "评估百济神州（688235）的核心投资风险：收入集中度、管线依赖性、竞争威胁、现金消耗速度，并提供风险调整后的投资建议。",
  },
];

const triageAlerts = [
  { ticker: "600276", name: "恒瑞", alert: "创新药收入占比突破 60% — 估值中枢有望上移", severity: "warn" as const, temp: "99.1°" },
  { ticker: "300760", name: "迈瑞", alert: "海外收入占比持续提升 — 关注汇率波动影响", severity: "info" as const, temp: "98.6°" },
  { ticker: "688235", name: "百济", alert: "连续亏损但泽布替尼放量 — 盈亏平衡点临近", severity: "critical" as const, temp: "102.8°" },
  { ticker: "603259", name: "药明", alert: "海外地缘政治风险 — 需关注客户订单变化", severity: "info" as const, temp: "96.4°" },
];

interface WelcomeDashboardProps {
  onSendPrompt: (text: string) => void;
  disabled?: boolean;
}

export function WelcomeDashboard({ onSendPrompt, disabled }: WelcomeDashboardProps) {
  return (
    <div className="h-full">
      {/* 板块心电 */}
      <div className="border-b border-border bg-card/30 relative">
        <div className="absolute inset-0 flex items-center px-4">
          <span className="font-mono text-sm tracking-widest text-scrub/50 z-10">板块脉搏</span>
        </div>
        <ECGCanvas condition="healthy" color="oklch(0.42 0.14 160 / 40%)" height={36} speed={1.5} lineWidth={1.5} />
      </div>

      <div className="p-5 space-y-6 overflow-y-auto">
        {/* 标题 */}
        <div className="flex items-center gap-4">
          <Stethoscope className="h-7 w-7 text-scrub" />
          <div>
            <span className="font-mono text-lg font-bold tracking-widest text-foreground">企业病房</span>
            <span className="mx-3 text-border">│</span>
            <span className="text-base text-muted-foreground">重点跟踪企业综合健康监控</span>
          </div>
        </div>

        {/* 企业生命体征卡片 */}
        <div className="grid grid-cols-2 gap-3">
          {patients.map((p) => (
            <CompanyVitalsCard key={p.ticker} data={p} />
          ))}
        </div>

        {/* 分诊预警 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="h-5 w-5 text-vitals-amber" />
            <span className="font-mono text-sm tracking-widest text-vitals-amber">分诊预警</span>
          </div>
          <div className="border border-border divide-y divide-border/50">
            {triageAlerts.map((a, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 bg-card/30 hover:bg-card/60 transition-colors">
                {a.severity === "critical"
                  ? <HeartCrack className="h-6 w-6 text-vitals-red shrink-0" />
                  : a.severity === "warn"
                    ? <ShieldAlert className="h-6 w-6 text-vitals-amber shrink-0" />
                    : <ShieldCheck className="h-6 w-6 text-plasma shrink-0" />
                }
                <span className="font-mono text-base font-bold text-foreground w-16 shrink-0">{a.name}</span>
                <p className="flex-1 text-base text-foreground/80">{a.alert}</p>
                <span className={cn(
                  "font-mono text-sm font-semibold tabular-nums shrink-0",
                  parseFloat(a.temp) > 100 ? "text-vitals-green" : parseFloat(a.temp) < 97 ? "text-plasma" : "text-muted-foreground"
                )}>
                  {a.temp}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 分析工具 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Pill className="h-5 w-5 text-scrub" />
            <span className="font-mono text-sm tracking-widest text-scrub">分析工具</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border">
            {procedures.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.code}
                  onClick={() => onSendPrompt(p.text)}
                  disabled={disabled}
                  className="group flex items-start gap-4 bg-card/50 p-4 text-left transition-all hover:bg-scrub/5 disabled:pointer-events-none disabled:opacity-40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-scrub/20 bg-scrub/5 group-hover:border-scrub/40 transition-colors">
                    <Icon className="h-5 w-5 text-scrub" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-muted-foreground">{p.code}</span>
                      <span className="text-base font-semibold text-foreground group-hover:text-scrub transition-colors">
                        {p.label}
                      </span>
                    </div>
                    <p className="mt-1 text-base text-muted-foreground">{p.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
