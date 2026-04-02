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

export default function LandingPage() {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden">
      {/* macOS wallpaper gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#f0eee9] via-[#eae8e4] to-[#ede9e3]" />

      {/* Floating ticker bar at top */}
      <div className="absolute top-0 inset-x-0 h-8 flex items-center px-6 text-[11px] text-foreground/40 overflow-hidden z-10">
        <div className="ticker-scroll flex items-center gap-6 whitespace-nowrap">
          {[...vitals, ...vitals, ...vitals].map((v, i) => (
            <span key={i} className="flex items-center gap-1">
              <span>{v.label}</span>
              <span className="text-foreground/60">{v.value}</span>
              <span className={cn("flex items-center gap-0.5", v.up ? "text-vitals-green" : "text-vitals-red")}>
                {v.up ? <HeartPulse className="h-3 w-3" /> : <HeartCrack className="h-3 w-3" />}
                {v.delta}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Main macOS Window card */}
      <div className="relative z-10 w-full max-w-[640px] mx-auto">
        <div className="rounded-2xl overflow-hidden bg-[#f6f5f4]/80 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)] border border-black/[0.05]">
          {/* Title bar */}
          <div className="flex h-12 items-center px-4 gap-3 border-b border-black/[0.05] bg-[#eceae8]/50">
            <div className="flex items-center gap-[7px]">
              <div className="h-3 w-3 rounded-full bg-[#EC6A5E] border border-[#D1503F]/40" />
              <div className="h-3 w-3 rounded-full bg-[#F4BF4F] border border-[#D49E28]/40" />
              <div className="h-3 w-3 rounded-full bg-[#61C554] border border-[#4CA93B]/40" />
            </div>
            <span className="text-[13px] text-foreground/50 font-medium">PharmaAlpha</span>
          </div>

          {/* Content */}
          <div className="flex flex-col items-center gap-8 px-10 py-12">
            {/* Logo */}
            <div className="relative">
              <div className="absolute -inset-6 bg-scrub/5 blur-3xl rounded-full" />
              <svg viewBox="0 0 80 80" className="relative h-20 w-20" fill="none">
                <rect x="2" y="2" width="76" height="76" rx="16" stroke="oklch(0.42 0.14 160)" strokeWidth="1.5" strokeDasharray="4 4" />
                <path
                  d="M40,52 C32,46 24,40 24,33 C24,28 28,24 33,24 C36,24 38,25 40,28 C42,25 44,24 47,24 C52,24 56,28 56,33 C56,40 48,46 40,52Z"
                  stroke="oklch(0.42 0.14 160)"
                  strokeWidth="1.5"
                  fill="oklch(0.42 0.14 160 / 12%)"
                />
                <polyline
                  points="24,38 33,38 36,30 40,46 44,34 47,38 56,38"
                  stroke="oklch(0.42 0.14 160)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="text-center space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">
                Pharma<span className="text-scrub">Alpha</span>
              </h1>
              <p className="text-sm text-foreground/50 max-w-sm leading-relaxed">
                AI 驱动的医药投资精准诊断平台，多维度解剖企业健康状况
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8">
              {[
                { n: "1,247", label: "诊断分析", icon: Microscope },
                { n: "98.6%", label: "预测精度", icon: HeartPulse },
                { n: "<2秒", label: "响应速度", icon: Stethoscope },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="text-center">
                    <Icon className="h-5 w-5 text-scrub mx-auto mb-1" />
                    <div className="text-2xl font-bold tabular-nums text-scrub">{s.n}</div>
                    <div className="text-[11px] text-foreground/40 mt-0.5">{s.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 w-full">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "flex-1 bg-scrub text-white font-semibold hover:bg-scrub/90 rounded-xl gap-2 h-11"
                )}
              >
                <Stethoscope className="h-5 w-5" />
                登录系统
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "flex-1 border-black/[0.08] text-foreground/70 font-semibold hover:bg-black/[0.03] rounded-xl gap-2 h-11"
                )}
              >
                <ShieldCheck className="h-5 w-5" />
                注册账号
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
