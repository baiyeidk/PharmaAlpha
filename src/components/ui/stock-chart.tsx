"use client";

import { useRef, useEffect, useCallback } from "react";
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type AreaSeriesPartialOptions } from "lightweight-charts";
import { cn } from "@/lib/utils";
import type { KlinePoint } from "@/hooks/use-stock-data";

interface StockChartProps {
  data: KlinePoint[];
  height?: number;
  className?: string;
  lineColor?: string;
  areaTopColor?: string;
  areaBottomColor?: string;
  showGrid?: boolean;
  showTime?: boolean;
  showPrice?: boolean;
  showCrosshair?: boolean;
}

export function StockChart({
  data,
  height = 120,
  className,
  lineColor,
  areaTopColor,
  areaBottomColor,
  showGrid = true,
  showTime = false,
  showPrice = true,
  showCrosshair = false,
}: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const isPositive = data.length >= 2 && data[data.length - 1].close >= data[0].close;

  const upColor = "#c23531";
  const downColor = "#2f9e44";
  const effectiveLineColor = lineColor ?? (isPositive ? upColor : downColor);
  const effectiveTopColor = areaTopColor ?? (isPositive ? "rgba(194,53,49,0.12)" : "rgba(47,158,68,0.12)");
  const effectiveBottomColor = areaBottomColor ?? "rgba(255,255,255,0)";

  const initChart = useCallback(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "#999",
        fontSize: 11,
        fontFamily: "var(--font-geist-mono), monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: {
          visible: showGrid,
          color: "rgba(0,0,0,0.04)",
        },
        horzLines: {
          visible: showGrid,
          color: "rgba(0,0,0,0.04)",
        },
      },
      rightPriceScale: {
        visible: showPrice,
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.05 },
      },
      timeScale: {
        visible: showTime,
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: showCrosshair ? 0 : 1,
        vertLine: {
          visible: showCrosshair,
          labelVisible: showCrosshair,
          color: "rgba(0,0,0,0.1)",
        },
        horzLine: {
          visible: showCrosshair,
          labelVisible: showCrosshair,
          color: "rgba(0,0,0,0.1)",
        },
      },
      handleScroll: false,
      handleScale: false,
    });

    const seriesOptions: AreaSeriesPartialOptions = {
      lineColor: effectiveLineColor,
      topColor: effectiveTopColor,
      bottomColor: effectiveBottomColor,
      lineWidth: 2,
      crosshairMarkerVisible: showCrosshair,
      priceLineVisible: false,
      lastValueVisible: false,
    };

    const series = chart.addSeries(AreaSeries, seriesOptions);

    const chartData = data.map((k) => ({
      time: k.date as string,
      value: k.close,
    }));

    if (chartData.length > 0) {
      series.setData(chartData);
      chart.timeScale().fitContent();
    }

    chartRef.current = chart;
    seriesRef.current = series;
  }, [data, height, effectiveLineColor, effectiveTopColor, effectiveBottomColor, showGrid, showTime, showPrice, showCrosshair]);

  useEffect(() => {
    initChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [initChart]);

  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chartRef.current?.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div ref={containerRef} style={{ height }} />
      {/* ECG 心电监护仪风格叠加: 扫描线 + 边缘晕光 */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-y-0 left-0 w-6"
          style={{ background: "linear-gradient(to right, white, transparent)" }}
        />
        <div
          className="absolute inset-y-0 right-0 w-6"
          style={{ background: "linear-gradient(to left, white, transparent)" }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: effectiveLineColor, opacity: 0.15 }}
        />
      </div>
    </div>
  );
}

export function MiniStockChart({
  data,
  height = 48,
  className,
}: {
  data: KlinePoint[];
  height?: number;
  className?: string;
}) {
  return (
    <StockChart
      data={data}
      height={height}
      className={className}
      showGrid={false}
      showTime={false}
      showPrice={false}
      showCrosshair={false}
    />
  );
}
