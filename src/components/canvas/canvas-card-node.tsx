"use client";

import { memo, useCallback, useState, useRef } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import {
  HeartPulse,
  ImageIcon,
  FileText,
  Type,
  X,
  GripVertical,
  Search,
  Upload,
  Loader2,
} from "lucide-react";
import { StockChart } from "@/components/ui/stock-chart";
import { ECGCanvas } from "@/components/ui/ecg-canvas";
import { useStockKline } from "@/hooks/use-stock-data";
import { useCanvasStore, type CanvasNodeData } from "@/stores/canvas-store";

const typeConfig: Record<
  string,
  { icon: typeof HeartPulse; color: string; label: string }
> = {
  chart: { icon: HeartPulse, color: "text-scrub", label: "图表" },
  image: { icon: ImageIcon, color: "text-plasma", label: "图片" },
  pdf: { icon: FileText, color: "text-vitals-amber", label: "PDF" },
  text: { icon: Type, color: "text-foreground/60", label: "文本" },
};

function tickerToCode(ticker: string): string {
  if (ticker.startsWith("sh") || ticker.startsWith("sz")) return ticker;
  const code = ticker.replace(/\D/g, "");
  if (!code) return "";
  if (code.startsWith("6")) return `sh${code}`;
  return `sz${code}`;
}

/* ── Chart: stock code input + chart display ── */

function ChartBody({ data, nodeId }: { data: CanvasNodeData; nodeId: string }) {
  const tickers = (data.tickers as string[]) || [];
  const hasTicker = tickers.length > 0 && tickers[0] !== "";
  const firstTicker = tickers[0] || "";
  const code = tickerToCode(firstTicker);
  const { kline, loading: klineLoading } = useStockKline(hasTicker ? code : "", "daily", 90);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [inputCode, setInputCode] = useState(firstTicker);

  const handleSubmit = useCallback(() => {
    const trimmed = inputCode.trim();
    if (!trimmed) return;
    const fullCode = tickerToCode(trimmed);
    updateNodeData(nodeId, {
      tickers: [trimmed],
      label: `${trimmed} 走势`,
      description: fullCode,
    });
  }, [inputCode, nodeId, updateNodeData]);

  if (!hasTicker) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4 nodrag nowheel">
        <HeartPulse className="h-8 w-8 text-scrub/30" />
        <p className="text-xs text-foreground/40">输入股票代码查看走势</p>
        <div className="flex items-center gap-1.5 w-full max-w-[240px]">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="例: 600276"
              className="nodrag nowheel w-full h-8 rounded-lg bg-black/[0.03] border border-black/[0.06] px-3 pr-8 text-xs text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-scrub/40"
            />
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground/25" />
          </div>
          <button
            onClick={handleSubmit}
            className="nodrag h-8 px-3 rounded-lg bg-scrub text-white text-xs font-medium hover:bg-scrub/90 transition-colors shrink-0"
          >
            查询
          </button>
        </div>
        <p className="text-[10px] text-foreground/25">支持沪深 A 股代码，如 600276、300760</p>
      </div>
    );
  }

  if (klineLoading || kline.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <ECGCanvas condition="healthy" color="oklch(0.45 0.10 160)" height={120} speed={2} lineWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <StockChart
        data={kline}
        height={Math.max(140, (data.height ?? 280) - 60)}
        showGrid
        showTime
        showPrice
        showCrosshair
      />
    </div>
  );
}

/* ── File Upload: shared by image/pdf ── */

function FileUploadBody({
  data,
  nodeId,
  accept,
  emptyIcon: EmptyIcon,
  emptyText,
  renderPreview,
}: {
  data: CanvasNodeData;
  nodeId: string;
  accept: string;
  emptyIcon: typeof ImageIcon;
  emptyText: string;
  renderPreview: (url: string, label: string) => React.ReactNode;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const conversationId = useCanvasStore((s) => s.conversationId);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!conversationId) return;
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("conversationId", conversationId);
        const res = await fetch("/api/files/upload", { method: "POST", body: fd });
        if (!res.ok) return;
        const result = await res.json();
        updateNodeData(nodeId, {
          url: result.url,
          label: result.originalName,
          description: `${(result.size / 1024).toFixed(1)} KB`,
        });
      } finally {
        setUploading(false);
      }
    },
    [conversationId, nodeId, updateNodeData],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  if (data.url) {
    return <>{renderPreview(data.url, data.label)}</>;
  }

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center gap-3 p-4 transition-colors nodrag nowheel ${
        dragOver ? "bg-scrub/5" : ""
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {uploading ? (
        <>
          <Loader2 className="h-8 w-8 text-scrub/40 animate-spin" />
          <p className="text-xs text-foreground/40">上传中…</p>
        </>
      ) : (
        <>
          <EmptyIcon className="h-8 w-8 text-foreground/15" />
          <p className="text-xs text-foreground/40">{emptyText}</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="nodrag flex items-center gap-1.5 h-8 px-3 rounded-lg bg-black/[0.04] border border-black/[0.06] text-xs text-foreground/60 hover:bg-black/[0.06] transition-colors"
          >
            <Upload className="h-3 w-3" />
            选择文件
          </button>
          <p className="text-[10px] text-foreground/25">或拖拽文件到此处</p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
        </>
      )}
    </div>
  );
}

function ImageBody({ data, nodeId }: { data: CanvasNodeData; nodeId: string }) {
  return (
    <FileUploadBody
      data={data}
      nodeId={nodeId}
      accept="image/*"
      emptyIcon={ImageIcon}
      emptyText="上传图片"
      renderPreview={(url, label) => (
        <div className="flex-1 min-h-0 p-2 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    />
  );
}

function PdfBody({ data, nodeId }: { data: CanvasNodeData; nodeId: string }) {
  return (
    <FileUploadBody
      data={data}
      nodeId={nodeId}
      accept=".pdf,application/pdf"
      emptyIcon={FileText}
      emptyText="上传 PDF 文件"
      renderPreview={(url, label) => (
        <div className="flex-1 min-h-0">
          <iframe src={url} title={label} className="w-full h-full" />
        </div>
      )}
    />
  );
}

/* ── Text: editable ── */

function TextBody({ data, nodeId }: { data: CanvasNodeData; nodeId: string }) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.content || "");

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (text !== (data.content || "")) {
      updateNodeData(nodeId, { content: text });
    }
  }, [text, data.content, nodeId, updateNodeData]);

  if (editing) {
    return (
      <div className="flex-1 min-h-0 p-1 nodrag nowheel">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          className="nodrag nowheel w-full h-full resize-none bg-transparent text-sm leading-relaxed text-foreground p-2 focus:outline-none"
          placeholder="输入文本内容…"
        />
      </div>
    );
  }

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto p-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap cursor-text nodrag"
      onClick={() => setEditing(true)}
    >
      {data.content || (
        <span className="text-foreground/25 text-xs">点击编辑文本…</span>
      )}
    </div>
  );
}

/* ── Main Node ── */

function CanvasCardNodeInner({ data, id }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const removeNode = useCanvasStore((s) => s.removeNode);
  const config = typeConfig[nodeData.nodeType] || typeConfig.text;
  const Icon = config.icon;

  const handleRemove = useCallback(() => {
    removeNode(id);
  }, [removeNode, id]);

  return (
    <div className="flex flex-col h-full rounded-xl bg-[#f6f5f4]/90 backdrop-blur-xl border border-black/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden group">
      <NodeResizer
        minWidth={200}
        minHeight={120}
        lineClassName="!border-scrub/30"
        handleClassName="!w-2.5 !h-2.5 !bg-scrub/50 !border-0 !rounded-full"
      />
      <div className="flex items-center h-7 px-2 gap-1.5 border-b border-black/[0.04] bg-[#eceae8]/40 shrink-0 drag-handle cursor-grab active:cursor-grabbing">
        <GripVertical className="h-3 w-3 text-foreground/20" />
        <Icon className={`h-3 w-3 ${config.color}`} />
        <span className="text-[10px] font-medium text-foreground/60 truncate flex-1">
          {nodeData.label || config.label}
        </span>
        <button
          onClick={handleRemove}
          className="nodrag h-4 w-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/[0.06] transition-opacity"
        >
          <X className="h-2.5 w-2.5 text-foreground/40" />
        </button>
      </div>

      {nodeData.nodeType === "chart" && <ChartBody data={nodeData} nodeId={id} />}
      {nodeData.nodeType === "image" && <ImageBody data={nodeData} nodeId={id} />}
      {nodeData.nodeType === "pdf" && <PdfBody data={nodeData} nodeId={id} />}
      {nodeData.nodeType === "text" && <TextBody data={nodeData} nodeId={id} />}

      {nodeData.description && (
        <div className="px-2 py-1 border-t border-black/[0.04] text-[9px] text-foreground/40 truncate">
          {nodeData.description}
        </div>
      )}

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-scrub/40 !border-2 !border-white hover:!bg-scrub !transition-colors" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-scrub/40 !border-2 !border-white hover:!bg-scrub !transition-colors" />
    </div>
  );
}

export const CanvasCardNode = memo(CanvasCardNodeInner);
