"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type NodeTypes,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
} from "@xyflow/react";
// CSS imported in globals.css
import { CanvasCardNode } from "./canvas-card-node";
import { useCanvasStore, type CanvasNodeData } from "@/stores/canvas-store";
import {
  HeartPulse,
  ImageIcon,
  FileText,
  Type,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nodeTypes: NodeTypes = {
  canvasCard: CanvasCardNode,
};

interface InfiniteCanvasProps {
  conversationId: string;
}

function useCanvasActions(conversationId: string) {
  const {
    nodes,
    edges,
    loading,
    setConversation,
    setNodes,
    setEdges,
    addNode,
  } = useCanvasStore();

  const prevConvRef = useRef<string | null>(null);

  useEffect(() => {
    if (conversationId !== prevConvRef.current) {
      prevConvRef.current = conversationId;
      setConversation(conversationId);
    }
  }, [conversationId, setConversation]);

  const handleAdd = useCallback(
    (type: "text" | "chart" | "image" | "pdf") => {
      const defaults: Record<string, { label: string; data: Partial<CanvasNodeData> }> = {
        text: { label: "文本笔记", data: { content: "" } },
        chart: { label: "股票图表", data: { tickers: [] } },
        image: { label: "图片", data: {} },
        pdf: { label: "PDF 文件", data: {} },
      };
      const d = defaults[type];

      const currentNodes = useCanvasStore.getState().nodes;
      const maxY = currentNodes.length > 0
        ? Math.max(...currentNodes.map((n) => n.position.y + ((n.data as CanvasNodeData).height ?? 240)))
        : 0;
      const w = 340;
      const h = type === "text" ? 180 : 280;

      const node: Node<CanvasNodeData> = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: "canvasCard",
        dragHandle: ".drag-handle",
        position: { x: (currentNodes.length % 2) * 360 + 20, y: maxY + 30 },
        data: { label: d.label, nodeType: type, width: w, height: h, ...d.data },
        style: { width: w, height: h },
      };

      addNode(node);
    },
    [addNode],
  );

  return { nodes, edges, loading, setNodes, setEdges, handleAdd };
}

function CanvasInner({ conversationId }: InfiniteCanvasProps) {
  const { nodes, edges, loading, setNodes, setEdges, handleAdd } = useCanvasActions(conversationId);
  const { fitView } = useReactFlow();
  const prevCountRef = useRef(nodes.length);

  useEffect(() => {
    if (nodes.length > 0 && nodes.length !== prevCountRef.current) {
      setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 100);
    }
    prevCountRef.current = nodes.length;
  }, [nodes.length, fitView]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      useCanvasStore.getState().flushSave();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      useCanvasStore.getState().flushSave();
    };
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const current = useCanvasStore.getState().nodes;
      setNodes(applyNodeChanges(changes, current) as Node<CanvasNodeData>[]);
    },
    [setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const current = useCanvasStore.getState().edges;
      setEdges(applyEdgeChanges(changes, current));
    },
    [setEdges],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const current = useCanvasStore.getState().edges;
      const newEdge: Edge = {
        ...connection,
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        animated: true,
        style: { stroke: "oklch(0.45 0.10 160)", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "oklch(0.45 0.10 160)", width: 16, height: 16 },
      };
      setEdges(addEdge(newEdge, current));
    },
    [setEdges],
  );

  const miniMapNodeColor = useCallback((node: Node) => {
    const d = node.data as CanvasNodeData;
    switch (d?.nodeType) {
      case "chart": return "oklch(0.45 0.10 160)";
      case "image": return "oklch(0.48 0.10 195)";
      case "pdf": return "oklch(0.52 0.10 80)";
      default: return "oklch(0.70 0 0)";
    }
  }, []);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const isEmpty = nodes.length === 0 && !loading;

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={proOptions}
          defaultEdgeOptions={{ animated: true }}
          connectionLineStyle={{ stroke: "oklch(0.45 0.10 160)", strokeWidth: 2 }}
          minZoom={0.1}
          maxZoom={3}
          className={cn(isEmpty && "pointer-events-none")}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} color="rgba(0,0,0,0.18)" />
          {!isEmpty && (
            <>
              <Controls
                position="bottom-left"
                className="!bg-[#f6f5f4]/80 !backdrop-blur-xl !border-black/[0.05] !rounded-xl !shadow-sm [&>button]:!border-black/[0.04] [&>button]:!bg-transparent [&>button:hover]:!bg-black/[0.03]"
              />
              <MiniMap
                nodeColor={miniMapNodeColor}
                maskColor="rgba(0,0,0,0.04)"
                className="!bg-[#f6f5f4]/60 !backdrop-blur-xl !border-black/[0.05] !rounded-xl !shadow-sm"
                position="bottom-right"
              />
              <Panel position="top-right" className="!m-3">
                <div className="flex items-center gap-1 rounded-xl bg-[#f6f5f4]/90 backdrop-blur-xl border border-black/[0.06] p-1 shadow-md">
                  <ToolbarButton icon={HeartPulse} label="图表" onClick={() => handleAdd("chart")} />
                  <ToolbarButton icon={ImageIcon} label="图片" onClick={() => handleAdd("image")} />
                  <ToolbarButton icon={FileText} label="PDF" onClick={() => handleAdd("pdf")} />
                  <ToolbarButton icon={Type} label="文本" onClick={() => handleAdd("text")} />
                </div>
              </Panel>
            </>
          )}
        </ReactFlow>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 z-10">
          <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
        </div>
      )}

      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center space-y-5">
            <div className="text-sm font-medium text-foreground/35">画布为空</div>
            <div className="text-xs text-foreground/25 max-w-[220px] mx-auto leading-relaxed">
              AI 分析结果会自动添加到画布，<br />也可手动添加内容
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <AddButton icon={HeartPulse} label="股票图表" onClick={() => handleAdd("chart")} />
              <AddButton icon={ImageIcon} label="图片" onClick={() => handleAdd("image")} />
              <AddButton icon={FileText} label="PDF" onClick={() => handleAdd("pdf")} />
              <AddButton icon={Type} label="文本笔记" onClick={() => handleAdd("text")} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function InfiniteCanvas({ conversationId }: InfiniteCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner conversationId={conversationId} />
    </ReactFlowProvider>
  );
}

function AddButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof HeartPulse;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 px-5 py-4 rounded-xl bg-[#f6f5f4]/80 border border-black/[0.06] hover:bg-[#eceae8] hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
    >
      <Icon className="h-6 w-6 text-scrub" />
      <span className="text-xs font-medium text-foreground/60">{label}</span>
    </button>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof HeartPulse;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-foreground/60",
        "hover:text-foreground hover:bg-black/[0.06] active:bg-black/[0.08] transition-colors cursor-pointer",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
