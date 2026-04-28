"use client";

import { useState } from "react";
import { ChevronRight, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageError, AgentLogLine } from "@/hooks/use-chat-stream";

const ERROR_CODE_LABELS: Record<string, string> = {
  // Agent-emitted
  AGENT_ERROR: "Agent 错误",
  CONFIG_ERROR: "配置错误",
  INPUT_ERROR: "输入错误",
  INPUT_DECODE_ERROR: "输入解析失败",
  EXECUTION_ERROR: "执行异常",
  LLM_ERROR: "LLM 调用失败",
  LLM_STREAM_ERROR: "LLM 流式中断",
  PEC_ERROR: "PEC 主流程异常",
  TOOL_LOOP_LIMIT: "工具调用次数上限",
  // Transport / executor
  TIMEOUT: "Agent 超时",
  EXIT_ERROR: "Agent 进程异常退出",
  SPAWN_ERROR: "Agent 启动失败",
  // Frontend
  HTTP_400: "HTTP 400 - 请求参数错误",
  HTTP_401: "HTTP 401 - 未授权",
  HTTP_404: "HTTP 404 - 资源不存在",
  HTTP_500: "HTTP 500 - 服务端错误",
  HTTP_502: "HTTP 502 - 网关错误",
  HTTP_503: "HTTP 503 - 服务不可用",
  NETWORK_ERROR: "网络错误",
  USER_ABORT: "用户中止",
  EMPTY_STREAM: "Agent 未返回内容",
};

const PHASE_LABELS: Record<string, string> = {
  bootstrap: "启动",
  plan: "规划",
  execute: "执行",
  check: "审查",
  synthesize: "合成",
  fatal: "致命错误",
  transport: "传输层",
};

interface ErrorBlockProps {
  errors: MessageError[];
  logs?: AgentLogLine[];
}

export function ErrorBlock({ errors, logs }: ErrorBlockProps) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="my-2 font-mono space-y-1">
      {errors.map((err) => (
        <ErrorEntry key={err.id} error={err} />
      ))}
      {logs && logs.length > 0 && <LogsPanel logs={logs} />}
    </div>
  );
}

function ErrorEntry({ error }: { error: MessageError }) {
  const isWarning = error.severity === "warning";
  const [showTrace, setShowTrace] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const codeLabel = ERROR_CODE_LABELS[error.code] || error.code;
  const phaseLabel = error.phase ? PHASE_LABELS[error.phase] || error.phase : "";
  const sourceLabel =
    error.source === "transport"
      ? "传输层"
      : error.source === "api"
      ? "Next.js"
      : error.source === "client"
      ? "前端"
      : "Agent";
  const sourceColor =
    error.source === "transport"
      ? "text-term-amber"
      : error.source === "api"
      ? "text-term-cyan"
      : error.source === "client"
      ? "text-term-green-dim"
      : "text-term-red";

  const Icon = isWarning ? AlertTriangle : AlertCircle;

  const detailsEntries =
    error.details && Object.keys(error.details).length > 0
      ? Object.entries(error.details)
      : null;

  return (
    <div
      className={cn(
        "rounded border px-2 py-1.5 text-xs",
        isWarning
          ? "border-term-amber/40 bg-term-amber/5"
          : "border-term-red/40 bg-term-red/5",
      )}
    >
      <div className="flex items-start gap-1.5 leading-snug">
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0 mt-[1px]",
            isWarning ? "text-term-amber" : "text-term-red",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-bold",
                isWarning ? "text-term-amber" : "text-term-red",
              )}
            >
              [{error.code}]
            </span>
            {phaseLabel && (
              <span className="text-[10px] text-term-green-dim">
                · {phaseLabel}
              </span>
            )}
            <span className={cn("text-[10px] ml-auto", sourceColor)}>
              {sourceLabel}
            </span>
          </div>
          <div
            className={cn(
              "mt-0.5 break-words whitespace-pre-wrap",
              isWarning ? "text-term-amber/90" : "text-term-red/90",
            )}
          >
            <span className="text-foreground/60 mr-1">{codeLabel}:</span>
            {error.content}
          </div>

          {detailsEntries && (
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="mt-1 flex items-center gap-1 text-[10px] text-term-green-dim hover:text-term-cyan cursor-pointer"
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform",
                  showDetails && "rotate-90",
                )}
              />
              <span>详情 ({detailsEntries.length})</span>
            </button>
          )}
          {detailsEntries && showDetails && (
            <div className="mt-1 ml-3 rounded bg-term-bg/50 px-2 py-1 text-[10px] text-foreground/70">
              {detailsEntries.map(([k, v]) => (
                <div key={k} className="break-all">
                  <span className="text-term-cyan">{k}</span>
                  <span className="text-muted-foreground">: </span>
                  <span>{typeof v === "string" ? v : JSON.stringify(v)}</span>
                </div>
              ))}
            </div>
          )}

          {error.traceback && (
            <button
              onClick={() => setShowTrace((v) => !v)}
              className="mt-1 flex items-center gap-1 text-[10px] text-term-green-dim hover:text-term-cyan cursor-pointer"
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform",
                  showTrace && "rotate-90",
                )}
              />
              <span>Traceback ({error.traceback.split("\n").length} 行)</span>
            </button>
          )}
          {error.traceback && showTrace && (
            <pre className="mt-1 ml-3 rounded bg-term-bg/50 p-2 text-[10px] text-foreground/70 max-h-64 overflow-auto whitespace-pre-wrap break-words">
              {error.traceback}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function LogsPanel({ logs }: { logs: AgentLogLine[] }) {
  const [expanded, setExpanded] = useState(false);
  // Show error/warn-level lines by default; collapse info-level lines.
  const errorLogs = logs.filter((l) => l.level === "error" || l.level === "warn");
  if (logs.length === 0) return null;

  return (
    <div className="mt-1 rounded border border-term-green/10 bg-term-bg/30 px-2 py-1 text-[10px]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 w-full text-term-green-dim hover:text-term-cyan cursor-pointer"
      >
        <ChevronRight
          className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
        />
        <Info className="h-3 w-3" />
        <span>
          Agent 日志 ({logs.length}
          {errorLogs.length > 0 && (
            <>
              ，<span className="text-term-red">{errorLogs.length} 条异常</span>
            </>
          )}
          )
        </span>
      </button>

      {!expanded && errorLogs.length > 0 && (
        <div className="mt-1 ml-3 space-y-0.5 text-term-red/80">
          {errorLogs.slice(-3).map((l) => (
            <div key={l.id} className="break-words">
              {l.message}
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-1 ml-3 space-y-0.5 max-h-64 overflow-auto">
          {logs.map((l) => (
            <div
              key={l.id}
              className={cn(
                "break-words font-mono",
                l.level === "error" && "text-term-red/85",
                l.level === "warn" && "text-term-amber/85",
                l.level === "info" && "text-foreground/60",
              )}
            >
              {l.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
