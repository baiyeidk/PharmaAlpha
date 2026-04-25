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
  Pencil,
  Eye,
  Save,
} from "lucide-react";
import { StockChart } from "@/components/ui/stock-chart";
import { ECGCanvas } from "@/components/ui/ecg-canvas";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { useStockKline } from "@/hooks/use-stock-data";
import { useCanvasStore, type CanvasNodeData } from "@/stores/canvas-store";
import { cn } from "@/lib/utils";

const typeConfig: Record<
  string,
  { icon: typeof HeartPulse; color: string; label: string }
> = {
  chart: { icon: HeartPulse, color: "text-term-green", label: "图表" },
  image: { icon: ImageIcon, color: "text-term-cyan", label: "图片" },
  pdf: { icon: FileText, color: "text-term-amber", label: "PDF" },
  text: { icon: Type, color: "text-term-green-dim", label: "文本" },
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
        <HeartPulse className="h-8 w-8 text-term-green/30" />
        <p className="text-xs text-term-green-dim font-mono">Enter stock code</p>
        <div className="flex items-center gap-1.5 w-full max-w-[240px]">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="e.g. 600276"
              className="nodrag nowheel w-full h-8 rounded-md bg-term-bg-surface border border-term-green/12 px-3 pr-8 text-xs text-term-green font-mono placeholder:text-term-green-dim/30 focus:outline-none focus:border-term-green/30"
            />
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-term-green-dim/40" />
          </div>
          <button
            onClick={handleSubmit}
            className="nodrag h-8 px-3 rounded-md bg-term-green/15 text-term-green text-xs font-mono hover:bg-term-green/25 transition-colors shrink-0"
          >
            Go
          </button>
        </div>
        <p className="text-[10px] text-term-green-dim/40 font-mono">A-share codes: 600276, 300760</p>
      </div>
    );
  }

  if (klineLoading || kline.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <ECGCanvas condition="healthy" color="#ff6d1f" height={120} speed={2} lineWidth={1.5} />
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
        dragOver ? "bg-term-green/5" : ""
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {uploading ? (
        <>
          <Loader2 className="h-8 w-8 text-term-green/40 animate-spin" />
          <p className="text-xs text-term-green-dim font-mono">Uploading...</p>
        </>
      ) : (
        <>
          <EmptyIcon className="h-8 w-8 text-term-green-dim/30" />
          <p className="text-xs text-term-green-dim font-mono">{emptyText}</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="nodrag flex items-center gap-1.5 h-8 px-3 rounded-md bg-term-bg-surface border border-term-green/12 text-xs text-term-green-dim font-mono hover:bg-term-green/10 hover:text-term-green transition-colors"
          >
            <Upload className="h-3 w-3" />
            Browse
          </button>
          <p className="text-[10px] text-term-green-dim/30 font-mono">or drag & drop</p>
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

/* ── Text: edit / preview with markdown ── */

function TextBody({ data, nodeId }: { data: CanvasNodeData; nodeId: string }) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [mode, setMode] = useState<"preview" | "edit">(data.content ? "preview" : "edit");
  const [text, setText] = useState(data.content || "");

  const handleSave = useCallback(() => {
    if (text !== (data.content || "")) {
      updateNodeData(nodeId, { content: text });
    }
    setMode("preview");
  }, [text, data.content, nodeId, updateNodeData]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-term-green/6 shrink-0">
        <button
          onClick={() => { if (mode === "edit") handleSave(); else setMode("preview"); }}
          className={cn(
            "nodrag flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-mono transition-colors",
            mode === "preview" ? "bg-term-green/10 text-term-green" : "text-term-green-dim hover:text-term-green",
          )}
        >
          <Eye className="h-2.5 w-2.5" />
          Preview
        </button>
        <button
          onClick={() => setMode("edit")}
          className={cn(
            "nodrag flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-mono transition-colors",
            mode === "edit" ? "bg-term-green/10 text-term-green" : "text-term-green-dim hover:text-term-green",
          )}
        >
          <Pencil className="h-2.5 w-2.5" />
          Edit
        </button>
      </div>

      {mode === "edit" ? (
        <div className="flex-1 min-h-0 p-1 nodrag nowheel">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleSave}
            autoFocus
            className="nodrag nowheel w-full h-full resize-none bg-transparent text-xs leading-relaxed text-foreground p-2 focus:outline-none font-mono"
            placeholder="Markdown supported..."
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 nodrag nowheel">
          {text ? (
            <div className="text-sm">
              <MarkdownRenderer content={text} />
            </div>
          ) : (
            <div
              className="flex items-center justify-center h-full cursor-pointer"
              onClick={() => setMode("edit")}
            >
              <span className="text-term-green-dim/40 text-xs font-mono">Click to edit...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Node ── */

function CanvasCardNodeInner({ data, id }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const removeNode = useCanvasStore((s) => s.removeNode);
  const projectId = useCanvasStore((s) => s.projectId);
  const [savingArtifact, setSavingArtifact] = useState(false);
  const config = typeConfig[nodeData.nodeType] || typeConfig.text;
  const Icon = config.icon;

  const handleRemove = useCallback(() => {
    removeNode(id);
  }, [removeNode, id]);

  const handleSaveArtifact = useCallback(async () => {
    if (!projectId || savingArtifact) return;
    const content = buildArtifactContentFromNode(nodeData);
    if (!content.trim()) return;

    setSavingArtifact(true);
    try {
      const res = await fetch(`/api/employee-investment/projects/${projectId}/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactType: `canvas_${nodeData.nodeType}`,
          title: nodeData.label || config.label,
          content,
          metadata: {
            source: "canvas",
            canvasNodeId: id,
            nodeType: nodeData.nodeType,
          },
        }),
      });
      if (!res.ok) {
        console.warn("[canvas] save artifact failed:", res.status);
      } else {
        window.dispatchEvent(
          new CustomEvent("employee-investment:artifact-created", {
            detail: { projectId },
          })
        );
      }
    } finally {
      setSavingArtifact(false);
    }
  }, [config.label, id, nodeData, projectId, savingArtifact]);

  return (
    <div className="flex flex-col h-full rounded-lg bg-term-bg-raised/90 backdrop-blur-xl border border-term-green/10 shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden group">
      <NodeResizer
        minWidth={200}
        minHeight={120}
        lineClassName="!border-term-green/30"
        handleClassName="!w-2.5 !h-2.5 !bg-term-green/50 !border-0 !rounded-full"
      />
      <div className="flex items-center h-7 px-2 gap-1.5 border-b border-term-green/8 bg-term-bg/60 shrink-0 drag-handle cursor-grab active:cursor-grabbing">
        <GripVertical className="h-3 w-3 text-term-green-dim/40" />
        <Icon className={`h-3 w-3 ${config.color}`} />
        <span className="text-[10px] font-mono text-term-green-dim truncate flex-1">
          {nodeData.label || config.label}
        </span>
        {projectId && (
          <button
            onClick={handleSaveArtifact}
            className="nodrag h-4 w-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-term-green/10 transition-opacity"
            title="Save as project artifact"
            disabled={savingArtifact}
          >
            {savingArtifact ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin text-term-green/70" />
            ) : (
              <Save className="h-2.5 w-2.5 text-term-green/70" />
            )}
          </button>
        )}
        <button
          onClick={handleRemove}
          className="nodrag h-4 w-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-term-red/10 transition-opacity"
        >
          <X className="h-2.5 w-2.5 text-term-red/60" />
        </button>
      </div>

      {nodeData.nodeType === "chart" && <ChartBody data={nodeData} nodeId={id} />}
      {nodeData.nodeType === "image" && <ImageBody data={nodeData} nodeId={id} />}
      {nodeData.nodeType === "pdf" && <PdfBody data={nodeData} nodeId={id} />}
      {nodeData.nodeType === "text" && <TextBody data={nodeData} nodeId={id} />}

      {nodeData.description && (
        <div className="px-2 py-1 border-t border-term-green/6 text-[9px] font-mono text-term-green-dim truncate">
          {nodeData.description}
        </div>
      )}

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-term-green/40 !border-2 !border-term-bg hover:!bg-term-green !transition-colors" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-term-green/40 !border-2 !border-term-bg hover:!bg-term-green !transition-colors" />
    </div>
  );
}

function buildArtifactContentFromNode(nodeData: CanvasNodeData) {
  const title = nodeData.label || "Canvas node";

  if (nodeData.nodeType === "text") {
    return nodeData.content ? `# ${title}\n\n${nodeData.content}` : "";
  }

  if (nodeData.nodeType === "chart") {
    const tickers = nodeData.tickers?.length ? nodeData.tickers.join(", ") : "none";
    return [
      `# ${title}`,
      "",
      `Type: chart`,
      `Tickers: ${tickers}`,
      nodeData.description ? `Description: ${nodeData.description}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (nodeData.nodeType === "image" || nodeData.nodeType === "pdf") {
    return [
      `# ${title}`,
      "",
      `Type: ${nodeData.nodeType}`,
      nodeData.url ? `URL: ${nodeData.url}` : null,
      nodeData.description ? `Description: ${nodeData.description}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return `# ${title}`;
}

export const CanvasCardNode = memo(CanvasCardNodeInner);
