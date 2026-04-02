"use client";

import {
  Syringe,
  Crosshair,
  CalendarClock,
  FlaskConical,
  Stethoscope,
  Pill,
  FileText,
  TrendingUp,
} from "lucide-react";
import { CompanyVitalsCard, type CompanyVitals } from "@/components/ui/company-vitals-card";

const patients: CompanyVitals[] = [
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
    ticker: "300760", name: "迈瑞医疗", price: "¥285.60", priceChange: "+1.8%", priceUp: true,
    revenue: "+20%", revenueStatus: "growing", pe: "35.8x", peStatus: "elevated",
    pipeline: "器械龙头", pipelineStatus: "strong", cashflow: "+¥42亿", cashflowStatus: "positive",
    sentiment: "98.6°", sentimentStatus: "warm", overallCondition: "healthy", stockCode: "sz300760",
  },
  {
    ticker: "688235", name: "百济神州", price: "¥142.30", priceChange: "-4.1%", priceUp: false,
    revenue: "-15%", revenueStatus: "declining", pe: "亏损", peStatus: "critical",
    pipeline: "6 期III", pipelineStatus: "moderate", cashflow: "-¥8亿", cashflowStatus: "negative",
    sentiment: "102.8°", sentimentStatus: "fever", overallCondition: "critical", stockCode: "sh688235",
  },
];

const procedures = [
  {
    icon: Syringe, label: "管线深度解剖",
    desc: "在研管线及临床进展",
    text: "深度分析恒瑞医药（600276）的在研药物管线，包括所有 III 期临床试验、成功概率、2026 年即将到来的审批节点和竞争格局。",
  },
  {
    icon: Crosshair, label: "企业健康对比",
    desc: "多维度横向对比",
    text: "横向对比药明康德（603259）和泰格医药（300347）：营收趋势、管线能力、估值水平、现金流健康度、客户集中度风险及整体投资逻辑。",
  },
  {
    icon: FileText, label: "财报病理分析",
    desc: "最新财报深度拆解",
    text: "对迈瑞医疗（300760）进行深度财报分析：最新季度收入结构、利润率趋势、研发投入效率、负债水平、现金流质量以及海外业务占比。",
  },
  {
    icon: CalendarClock, label: "审批日历前瞻",
    desc: "NMPA/CDE 审批追踪",
    text: "本季度有哪些重要的 NMPA 审批节点和新药上市申请？包括潜在的收入影响、竞争格局分析和概率加权评估。",
  },
  {
    icon: FlaskConical, label: "行业全景解剖",
    desc: "宏观趋势报告",
    text: "给出中国医药行业全景分析：板块涨跌龙虎榜、集采政策影响、创新药出海进展、并购动态、资金流向及政策风向。",
  },
  {
    icon: Pill, label: "风险评估处方",
    desc: "投资风险多维评估",
    text: "评估百济神州（688235）的核心投资风险：收入集中度、管线依赖性、竞争威胁、现金消耗速度，并提供风险调整后的投资建议。",
  },
];

interface WelcomeDashboardProps {
  onSendPrompt: (text: string) => void;
  disabled?: boolean;
}

export function WelcomeDashboard({ onSendPrompt, disabled }: WelcomeDashboardProps) {
  return (
    <div>
      <div className="max-w-[920px] mx-auto px-6 py-8 space-y-8">

        {/* 标题 */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-scrub/10">
            <Stethoscope className="h-5 w-5 text-scrub" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">企业健康监控中心</h1>
            <p className="text-xs text-muted-foreground">医药行业重点企业多维度分析</p>
          </div>
        </div>

        {/* 企业卡片 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-foreground" />
            <span className="text-sm font-semibold text-foreground">重点跟踪</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {patients.map((p) => (
              <CompanyVitalsCard key={p.ticker} data={p} />
            ))}
          </div>
        </section>

        {/* 快捷分析 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Pill className="h-4 w-4 text-scrub" />
            <span className="text-sm font-semibold text-scrub">快捷分析</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {procedures.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.label}
                  onClick={() => onSendPrompt(p.text)}
                  disabled={disabled}
                  className="group rounded-xl p-3.5 text-left transition-all bg-white/50 border border-black/[0.04] hover:bg-white/80 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-scrub/8 mb-2 group-hover:bg-scrub/14 transition-colors">
                    <Icon className="h-4 w-4 text-scrub" />
                  </div>
                  <span className="text-sm font-medium text-foreground group-hover:text-scrub transition-colors block">
                    {p.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">{p.desc}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
