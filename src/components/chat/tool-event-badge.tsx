"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
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

export function ToolEventBadge({ event }: ToolEventBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const displayName = TOOL_DISPLAY_NAMES[event.name] || event.name;
  const hasDetails = event.args || event.result;

  return (
    <div className="inline-flex flex-col">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors",
          event.status === "running" && "bg-scrub/10 text-scrub",
          event.status === "success" && "bg-emerald-500/10 text-emerald-700",
          event.status === "error" && "bg-red-500/10 text-red-600",
          hasDetails && "cursor-pointer hover:bg-black/[0.06]",
          !hasDetails && "cursor-default bg-black/[0.04] text-foreground/60",
        )}
      >
        {event.status === "running" && (
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        )}
        {event.status === "success" && (
          <CheckCircle2 className="h-2.5 w-2.5" />
        )}
        {event.status === "error" && (
          <XCircle className="h-2.5 w-2.5" />
        )}
        {displayName}
        {hasDetails && (
          <ChevronDown className={cn(
            "h-2.5 w-2.5 transition-transform",
            expanded && "rotate-180"
          )} />
        )}
      </button>

      {expanded && hasDetails && (
        <div className="mt-1 rounded-md border border-black/[0.06] bg-white text-[10px] font-mono overflow-hidden max-w-sm">
          {event.args && Object.keys(event.args).length > 0 && (
            <div className="px-2 py-1.5 border-b border-black/[0.04]">
              <span className="text-foreground/40 text-[9px] uppercase tracking-wider">参数</span>
              <div className="mt-0.5 text-foreground/70 break-all">
                {Object.entries(event.args).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-blue-600">{k}</span>
                    <span className="text-foreground/30">: </span>
                    <span>{typeof v === "string" ? v : JSON.stringify(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {event.result && (
            <div className="px-2 py-1.5">
              <span className="text-foreground/40 text-[9px] uppercase tracking-wider">结果</span>
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
