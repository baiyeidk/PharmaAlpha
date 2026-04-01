"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { HeartPulse, HeartCrack, Stethoscope, ShieldCheck, Microscope } from "lucide-react";
import { cn } from "@/lib/utils";

const vitals = [
  { label: "沪深医药", value: "8,247", delta: "+1.24%", up: true },
  { label: "中证医疗", value: "12,385", delta: "-0.38%", up: false },
  { label: "生物医药ETF", value: "1.042", delta: "+0.82%", up: true },
  { label: "创新药指数", value: "3,618", delta: "+0.45%", up: true },
];

function VitalsMonitor() {
  return (
    <div className="flex items-center gap-6">
      {vitals.map((v) => (
        <div key={v.label} className="flex items-center gap-3 font-mono text-base">
          <span className="text-muted-foreground">{v.label}</span>
          <span className="text-foreground tabular-nums">{v.value}</span>
          <span className={cn("flex items-center gap-0.5", v.up ? "text-vitals-green" : "text-vitals-red")}>
            {v.up
              ? <HeartPulse className="h-5 w-5" />
              : <HeartCrack className="h-5 w-5" />
            }
            {v.delta}
          </span>
        </div>
      ))}
    </div>
  );
}

function ECGLine() {
  return (
    <svg
      className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-24 pointer-events-none opacity-20"
      viewBox="0 0 1200 80"
      preserveAspectRatio="none"
      fill="none"
    >
      <path
        d="M0,40 L280,40 L320,40 L340,12 L360,68 L380,25 L400,40 L500,38 L600,36 L700,34 L800,32 L900,30 L1000,32 L1100,30 L1200,28"
        stroke="oklch(0.42 0.14 160)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ecg-line"
      />
    </svg>
  );
}

function ScanlineOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
      <div className="animate-scanline h-px w-full bg-scrub" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 bg-surgical-grid opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_400px_at_center,oklch(0.42_0.14_160_/_8%),transparent)]" />

      <ECGLine />
      <ScanlineOverlay />

      {/* 顶部状态栏 */}
      <div className="absolute top-0 left-0 right-0 h-12 border-b border-border/60 flex items-center px-6 font-mono text-base text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-scrub animate-pulse-glow" />
          <span>系统在线</span>
        </div>
        <div className="ml-auto overflow-hidden max-w-[60%]">
          <VitalsMonitor />
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-12 px-8">
        {/* Logo */}
        <div className="relative">
          <div className="absolute -inset-8 bg-scrub/5 blur-3xl rounded-full" />
          <div className="relative flex flex-col items-center gap-1">
            <svg viewBox="0 0 80 80" className="h-28 w-28" fill="none">
              <rect x="2" y="2" width="76" height="76" rx="2" stroke="oklch(0.42 0.14 160)" strokeWidth="1" strokeDasharray="4 4" />
              <rect x="10" y="10" width="60" height="60" rx="2" stroke="oklch(0.42 0.14 160 / 40%)" strokeWidth="0.5" />
              <line x1="40" y1="18" x2="40" y2="62" stroke="oklch(0.42 0.14 160)" strokeWidth="0.5" />
              <line x1="18" y1="40" x2="62" y2="40" stroke="oklch(0.42 0.14 160)" strokeWidth="0.5" />
              <path
                d="M40,52 C32,46 24,40 24,33 C24,28 28,24 33,24 C36,24 38,25 40,28 C42,25 44,24 47,24 C52,24 56,28 56,33 C56,40 48,46 40,52Z"
                stroke="oklch(0.42 0.14 160)"
                strokeWidth="1.5"
                fill="oklch(0.42 0.14 160 / 15%)"
              />
              <polyline
                points="24,38 33,38 36,30 40,46 44,34 47,38 56,38"
                stroke="oklch(0.42 0.14 160)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M14,22 L14,14 L22,14" stroke="oklch(0.42 0.14 160)" strokeWidth="1.5" />
              <path d="M58,14 L66,14 L66,22" stroke="oklch(0.42 0.14 160)" strokeWidth="1.5" />
              <path d="M66,58 L66,66 L58,66" stroke="oklch(0.42 0.14 160)" strokeWidth="1.5" />
              <path d="M22,66 L14,66 L14,58" stroke="oklch(0.42 0.14 160)" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5 text-center">
          <h1 className="font-mono text-7xl font-bold tracking-tight text-foreground uppercase">
            Pharma<span className="text-scrub">Alpha</span>
          </h1>

          <div className="flex items-center gap-4 font-mono text-base tracking-[0.15em] text-muted-foreground">
            <span className="h-px w-12 bg-scrub/40" />
            AI 驱动 · 医药投资精准诊断
            <span className="h-px w-12 bg-scrub/40" />
          </div>

          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            如同外科医生精准定位病灶，我们用 AI 深度解剖上市公司的财报、管线与市场数据，
            为医药行业投资者提供多维度的企业「健康诊断」。
          </p>
        </div>

        <div className="flex gap-4">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-scrub text-marrow font-mono text-lg font-semibold tracking-wider hover:bg-scrub/90 px-8 rounded-sm gap-3"
            )}
          >
            <Stethoscope className="h-7 w-7" />
            登录系统
          </Link>
          <Link
            href="/register"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "border-scrub/40 text-scrub font-mono text-lg tracking-wider hover:bg-scrub/10 hover:border-scrub px-8 rounded-sm gap-3"
            )}
          >
            <ShieldCheck className="h-7 w-7" />
            注册账号
          </Link>
        </div>

        {/* 数据统计 */}
        <div className="grid grid-cols-3 gap-px mt-4">
          {[
            { n: "1,247", label: "诊断分析", icon: Microscope },
            { n: "98.6%", label: "预测精度", icon: HeartPulse },
            { n: "<2秒", label: "响应速度", icon: Stethoscope },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="px-6 py-3 text-center border border-border/40 bg-card/30">
                <Icon className="h-6 w-6 text-scrub mx-auto mb-1.5" />
                <div className="font-mono text-4xl font-bold tabular-nums text-scrub">{s.n}</div>
                <div className="font-mono text-sm tracking-widest text-muted-foreground mt-1">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部行情滚动条 */}
      <div className="absolute bottom-0 inset-x-0 h-10 border-t border-border/60 flex items-center px-6 font-mono text-sm text-muted-foreground overflow-hidden">
        <div className="ticker-scroll flex items-center gap-8 whitespace-nowrap">
          {[...vitals, ...vitals, ...vitals].map((v, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>{v.label}</span>
              <span className="text-foreground">{v.value}</span>
              <span className={cn("flex items-center gap-0.5", v.up ? "text-vitals-green" : "text-vitals-red")}>
                {v.up ? <HeartPulse className="h-4 w-4" /> : <HeartCrack className="h-4 w-4" />}
                {v.delta}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
