"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const tickerData = [
  { sym: "PFE", price: "42.38", change: "+2.1%", up: true },
  { sym: "JNJ", price: "156.22", change: "-0.4%", up: false },
  { sym: "MRK", price: "128.55", change: "+1.8%", up: true },
  { sym: "ABBV", price: "184.32", change: "+0.9%", up: true },
  { sym: "LLY", price: "792.10", change: "-1.2%", up: false },
  { sym: "BMY", price: "51.83", change: "+3.2%", up: true },
  { sym: "AMGN", price: "286.47", change: "-0.6%", up: false },
  { sym: "GILD", price: "84.26", change: "+1.4%", up: true },
  { sym: "AZN", price: "67.91", change: "+0.7%", up: true },
  { sym: "NVO", price: "138.45", change: "-2.1%", up: false },
];

function TickerStrip() {
  const items = [...tickerData, ...tickerData];
  return (
    <div className="absolute inset-x-0 bottom-0 h-8 border-t border-border/40 overflow-hidden bg-background/50">
      <div className="ticker-scroll flex h-full items-center gap-8 whitespace-nowrap px-4">
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="text-muted-foreground">{t.sym}</span>
            <span className={t.up ? "text-pa-green" : "text-pa-red"}>
              {t.up ? "▲" : "▽"}
            </span>
            <span className="text-muted-foreground">{t.price}</span>
            <span className={t.up ? "text-pa-green" : "text-pa-red"}>
              ({t.change})
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 bg-dot-grid opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.95_0.01_195)_0%,transparent_70%)]" />

      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-[0.12]">
        <svg
          className="w-full h-32"
          viewBox="0 0 1200 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0,60 L280,60 L320,60 L345,18 L370,85 L395,35 L415,60 L500,58 L580,54 L660,48 L740,44 L820,40 L900,36 L980,33 L1060,38 L1140,35 L1200,34"
            stroke="oklch(0.47 0.14 195)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ecg-line"
          />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-10 px-8">
        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-pa-cyan/8 blur-3xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-pa-cyan/25 bg-white shadow-sm">
            <Activity className="h-10 w-10 text-pa-cyan" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            PharmaAlpha
          </h1>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-pa-amber">
            <span className="h-px w-10 bg-pa-amber/30" />
            Pharmaceutical Investment Intelligence
            <span className="h-px w-10 bg-pa-amber/30" />
          </div>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            AI-powered agent platform bridging pharmaceutical research
            and capital markets. Real-time analysis, data-driven insights,
            and intelligent decision support.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-pa-cyan text-white font-medium hover:bg-pa-cyan/90 px-8"
            )}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "border-pa-cyan/30 text-pa-cyan hover:bg-pa-cyan/5 hover:border-pa-cyan/50 px-8"
            )}
          >
            Create account
          </Link>
        </div>
      </div>

      <TickerStrip />
    </div>
  );
}
