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
  projectId?: string;
}

function useCanvasActions(conversationId: string, projectId?: string) {
  const {
    nodes,
    edges,
    loading,
    setConversation,
    setProject,
    setNodes,
    setEdges,
    addNode,
  } = useCanvasStore();

  const prevConvRef = useRef<string | null>(null);

  useEffect(() => {
    setProject(projectId ?? null);
    return () => setProject(null);
  }, [projectId, setProject]);

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

function CanvasInner({ conversationId, projectId }: InfiniteCanvasProps) {
  const { nodes, edges, loading, setNodes, setEdges, handleAdd } = useCanvasActions(
    conversationId,
    projectId
  );
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
        style: { stroke: "#ff6d1f", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#ff6d1f", width: 16, height: 16 },
      };
      setEdges(addEdge(newEdge, current));
    },
    [setEdges],
  );

  const miniMapNodeColor = useCallback((node: Node) => {
    const d = node.data as CanvasNodeData;
    switch (d?.nodeType) {
      case "chart": return "#ff6d1f";
      case "image": return "#06B6D4";
      case "pdf": return "#F59E0B";
      default: return "#9CA3AF";
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
          connectionLineStyle={{ stroke: "#ff6d1f", strokeWidth: 1.5 }}
          minZoom={0.1}
          maxZoom={3}
          className={cn(isEmpty && "pointer-events-none")}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(255,255,255,0.05)" />
          {!isEmpty && (
            <>
              <Controls
                position="bottom-left"
                className="!bg-term-bg-raised/80 !backdrop-blur-xl !border-term-green/10 !rounded-lg !shadow-sm [&>button]:!border-term-green/8 [&>button]:!bg-transparent [&>button]:!text-term-green-dim [&>button:hover]:!bg-term-bg-surface [&>button:hover]:!text-term-green"
              />
              <MiniMap
                nodeColor={miniMapNodeColor}
                maskColor="oklch(0 0 0 / 30%)"
                className="!bg-term-bg-raised/60 !backdrop-blur-xl !border-term-green/10 !rounded-lg !shadow-sm"
                position="bottom-right"
              />
              <Panel position="top-right" className="!m-3">
                <div className="flex items-center gap-1 rounded-lg bg-term-bg-raised/90 backdrop-blur-xl border border-term-green/10 p-1 shadow-md font-mono">
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
        <div className="absolute inset-0 flex items-center justify-center bg-term-bg/50 z-10">
          <Loader2 className="h-5 w-5 animate-spin text-term-green-dim" />
        </div>
      )}

      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center space-y-5 font-mono">
            <div className="text-sm text-term-green-dim">Canvas Empty</div>
            <div className="text-xs text-term-green-dim/50 max-w-[220px] mx-auto leading-relaxed">
              AI analysis will appear here automatically,<br />or add content manually
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

export function InfiniteCanvas({ conversationId, projectId }: InfiniteCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner conversationId={conversationId} projectId={projectId} />
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
      className="flex flex-col items-center gap-2 rounded-[4px] border border-[var(--nf-border-invisible)] bg-[var(--nf-bg-surface)] px-5 py-4 transition-[border-color,background-color,box-shadow] duration-200 hover:border-[rgba(255,109,31,0.35)] hover:bg-[var(--nf-accent-muted)] hover:shadow-[var(--nf-glow-sm)] active:scale-[0.98] cursor-pointer"
    >
      <Icon className="h-6 w-6 text-term-green" />
      <span className="text-xs font-mono text-term-green-dim">{label}</span>
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
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono text-term-green-dim",
        "hover:text-term-green hover:bg-term-bg-surface active:bg-term-bg transition-colors cursor-pointer",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
