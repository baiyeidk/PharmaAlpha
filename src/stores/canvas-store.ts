import type React from "react";
import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

export type CanvasNodeType = "chart" | "image" | "pdf" | "text";

export interface CanvasNodeData extends Record<string, unknown> {
  label: string;
  nodeType: CanvasNodeType;
  url?: string;
  content?: string;
  tickers?: string[];
  description?: string;
  width?: number;
  height?: number;
}

interface CanvasState {
  conversationId: string | null;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  loading: boolean;
  dirty: boolean;

  setConversation: (id: string | null) => void;
  setNodes: (nodes: Node<CanvasNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node<CanvasNodeData>) => void;
  removeNode: (id: string) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeSize: (id: string, width: number, height: number) => void;
  updateNodeData: (id: string, patch: Partial<CanvasNodeData>) => void;
  loadFromServer: (conversationId: string) => Promise<void>;
  saveToServer: () => Promise<void>;
  flushSave: () => void;
  addNodeAndSave: (params: {
    type: CanvasNodeType;
    label: string;
    data?: Partial<CanvasNodeData>;
  }) => Promise<void>;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let saving = false;
let pendingSave = false;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  conversationId: null,
  nodes: [],
  edges: [],
  loading: false,
  dirty: false,

  setConversation: (id) => {
    const current = get().conversationId;
    if (current === id) return;
    if (current && get().dirty) {
      get().saveToServer();
    }
    set({ conversationId: id, nodes: [], edges: [], loading: false, dirty: false });
    if (id) get().loadFromServer(id);
  },

  setNodes: (nodes) => {
    set({ nodes, dirty: true });
    debouncedSave(get);
  },

  setEdges: (edges) => {
    set({ edges, dirty: true });
    get().saveToServer();
  },

  addNode: (node) => {
    set((s) => ({ nodes: [...s.nodes, node], dirty: true }));
    get().saveToServer();
  },

  removeNode: (id) => {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      dirty: true,
    }));
    get().saveToServer();
  },

  updateNodePosition: (id, x, y) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, position: { x, y } } : n
      ),
      dirty: true,
    }));
    debouncedSave(get);
  },

  updateNodeSize: (id, width, height) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, width, height } }
          : n
      ),
      dirty: true,
    }));
    debouncedSave(get);
  },

  updateNodeData: (id, patch) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, ...patch } }
          : n
      ),
      dirty: true,
    }));
    debouncedSave(get);
  },

  loadFromServer: async (conversationId) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/canvas/${conversationId}`);
      if (!res.ok) {
        set({ loading: false });
        return;
      }
      const { nodes: dbNodes, edges: dbEdges } = await res.json();
      const rfNodes: Node<CanvasNodeData>[] = (dbNodes || []).map(
        (n: {
          id: string;
          type: string;
          label: string;
          positionX: number;
          positionY: number;
          width: number;
          height: number;
          data: Record<string, unknown> | null;
        }) => ({
          id: n.id,
          type: "canvasCard",
          dragHandle: ".drag-handle",
          position: { x: n.positionX, y: n.positionY },
          data: {
            label: n.label,
            nodeType: n.type as CanvasNodeType,
            width: n.width,
            height: n.height,
            ...(n.data || {}),
          },
          style: { width: n.width, height: n.height },
        })
      );
      const rfEdges: Edge[] = (dbEdges || []).map(
        (e: {
          id: string;
          sourceNodeId: string;
          targetNodeId: string;
          animated: boolean;
          style: Record<string, unknown> | null;
        }) => ({
          id: e.id,
          source: e.sourceNodeId,
          target: e.targetNodeId,
          animated: e.animated,
          style: e.style ? (e.style as React.CSSProperties) : { stroke: "oklch(0.45 0.10 160)", strokeWidth: 2 },
          markerEnd: { type: "arrowclosed" as const, color: "oklch(0.45 0.10 160)", width: 16, height: 16 },
        })
      );
      set({ nodes: rfNodes, edges: rfEdges, loading: false, dirty: false });
    } catch {
      set({ loading: false });
    }
  },

  saveToServer: async () => {
    const { conversationId, nodes, edges } = get();
    if (!conversationId) return;

    if (saving) {
      pendingSave = true;
      return;
    }
    saving = true;

    const body = buildSavePayload(nodes, edges);

    try {
      const res = await fetch(`/api/canvas/${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
      if (res.ok) {
        set({ dirty: false });
      }
    } catch {
      // silent fail, retry on next change
    } finally {
      saving = false;
      if (pendingSave) {
        pendingSave = false;
        get().saveToServer();
      }
    }
  },

  flushSave: () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    const { conversationId, nodes, edges, dirty } = get();
    if (!conversationId || !dirty || nodes.length === 0) return;
    const body = buildSavePayload(nodes, edges);
    try {
      fetch(`/api/canvas/${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      // best-effort
    }
    set({ dirty: false });
  },

  addNodeAndSave: async ({ type, label, data }) => {
    const { conversationId, nodes } = get();
    if (!conversationId) {
      console.warn("[canvas] addNodeAndSave: no conversationId, skipped");
      return;
    }

    const maxY = nodes.length > 0
      ? Math.max(...nodes.map((n) => n.position.y + ((n.data as CanvasNodeData).height ?? 240)))
      : 0;

    const col = nodes.length % 2;
    const x = col * 360 + 20;
    const y = maxY + 30;
    const w = 340;
    const h = type === "text" ? 180 : 280;
    const tempId = crypto.randomUUID();

    const rfNode: Node<CanvasNodeData> = {
      id: tempId,
      type: "canvasCard",
      dragHandle: ".drag-handle",
      position: { x, y },
      data: {
        label,
        nodeType: type,
        width: w,
        height: h,
        ...data,
      },
      style: { width: w, height: h },
    };

    set((s) => ({ nodes: [...s.nodes, rfNode], dirty: true }));

    try {
      const res = await fetch(`/api/canvas/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          label,
          positionX: x,
          positionY: y,
          width: w,
          height: h,
          data: { label, nodeType: type, ...data },
        }),
      });
      if (!res.ok) {
        console.warn("[canvas] POST failed:", res.status, await res.text().catch(() => ""));
        return;
      }
      const { node: created } = await res.json();
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === tempId ? { ...n, id: created.id } : n
        ),
      }));
    } catch (err) {
      console.warn("[canvas] addNodeAndSave error:", err);
    }
  },
}));

function buildSavePayload(nodes: Node<CanvasNodeData>[], edges: Edge[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.data as CanvasNodeData).nodeType,
      label: (n.data as CanvasNodeData).label,
      positionX: n.position.x,
      positionY: n.position.y,
      width: (n.data as CanvasNodeData).width ?? n.style?.width ?? 320,
      height: (n.data as CanvasNodeData).height ?? n.style?.height ?? 240,
      data: n.data,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sourceNodeId: e.source,
      targetNodeId: e.target,
      animated: e.animated ?? true,
      style: e.style ?? null,
    })),
  };
}

function debouncedSave(get: () => CanvasState) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    get().saveToServer();
  }, 800);
}
