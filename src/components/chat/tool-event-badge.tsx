"use client";

import { useState } from "react";
import { AsciiSpinner } from "@/components/terminal/ascii-spinner";
import type { ToolEvent } from "@/hooks/use-chat-stream";
import { cn } from "@/lib/utils";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_stock_quote: "股票行情",
  get_stock_kline: "K线数据",
  search_web: "网页搜索",
  fetch_webpage: "抓取网页",
  fetch_financial_report: "获取财报",
  read_uploaded_pdf: "读取PDF",
  canvas_add_chart: "添加图表",
  canvas_add_text: "添加文本",
  canvas_add_image: "添加图片",
  canvas_remove_node: "移除节点",
  canvas_update_node: "更新节点",
  memory_recall: "记忆检索",
  rag_search: "知识库检索",
  rag_ingest: "知识库导入",
  search_financial_reports: "搜索财报",
  search_research_reports: "搜索研报",
  download_report_to_rag: "下载研报→知识库",
};

interface ToolEventBadgeProps {
  event: ToolEvent;
}

function formatMs(ms?: number): string {
  if (typeof ms !== "number" || ms < 0) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

export function ToolEventBadge({ event }: ToolEventBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const displayName = TOOL_DISPLAY_NAMES[event.name] || event.name;
  const hasDetails = event.args || event.result;

  const argsStr = event.args
    ? Object.entries(event.args)
        .map(([k, v]) => `${k}=${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`)
        .join(", ")
    : "";

  const elapsedLabel = formatMs(event.elapsedMs);

  return (
    <div className="font-mono text-xs">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1 transition-colors text-left",
          hasDetails && "cursor-pointer hover:text-term-green",
          !hasDetails && "cursor-default",
        )}
      >
        {event.status === "running" && (
          <>
            <span className="text-term-green-dim">&gt; </span>
            <span className="text-term-cyan">{event.name}</span>
            <span className="text-term-green-dim">({argsStr.slice(0, 40)}{argsStr.length > 40 ? "…" : ""})</span>
            <AsciiSpinner variant="braille" className="ml-1 text-[10px]" />
          </>
        )}
        {event.status === "success" && (
          <>
            <span className="text-term-green-dim">← </span>
            <span className="text-term-green">[OK]</span>
            <span className="text-term-green-dim ml-1">{displayName}</span>
            {elapsedLabel && (
              <span className="text-term-green-dim/70 ml-1">[{elapsedLabel}]</span>
            )}
          </>
        )}
        {event.status === "error" && (
          <>
            <span className="text-term-red">← </span>
            <span className="text-term-red">[ERR]</span>
            <span className="text-term-red/70 ml-1">{displayName}</span>
            {elapsedLabel && (
              <span className="text-term-red/60 ml-1">[{elapsedLabel}]</span>
            )}
          </>
        )}
      </button>

      {expanded && hasDetails && (
        <div className="mt-1 ml-3 rounded border border-term-green/10 bg-term-bg text-[10px] overflow-hidden max-w-md">
          {event.args && Object.keys(event.args).length > 0 && (
            <div className="px-2 py-1.5 border-b border-term-green/8">
              <span className="text-term-green-dim text-[9px] uppercase tracking-wider">ARGS</span>
              <div className="mt-0.5 text-foreground/70 break-all">
                {Object.entries(event.args).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-term-cyan">{k}</span>
                    <span className="text-muted-foreground">: </span>
                    <span>{typeof v === "string" ? v : JSON.stringify(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {event.result && (
            <div className="px-2 py-1.5">
              <span className="text-muted-foreground text-[9px] uppercase tracking-wider">RESULT</span>
              <div className="mt-0.5 text-foreground/70 break-all max-h-32 overflow-y-auto whitespace-pre-wrap">
                {event.result.length > 500
                  ? event.result.slice(0, 500) + "…"
                  : event.result}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
