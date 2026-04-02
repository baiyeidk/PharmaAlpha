import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { AgentOutputChunk } from "./types";

interface CanvasAddNodeArgs {
  type: "chart" | "image" | "pdf" | "text";
  label: string;
  tickers?: string[];
  content?: string;
  url?: string;
  description?: string;
  width?: number;
  height?: number;
}

interface CanvasRemoveNodeArgs {
  nodeId: string;
}

interface CanvasUpdateNodeArgs {
  nodeId: string;
  label?: string;
  content?: string;
  tickers?: string[];
  description?: string;
}

export async function executeCanvasTool(
  chunk: AgentOutputChunk,
  conversationId: string,
): Promise<AgentOutputChunk> {
  const { name, args = {} } = chunk;

  try {
    switch (name) {
      case "canvas.add_node":
        return await handleAddNode(args as unknown as CanvasAddNodeArgs, conversationId);
      case "canvas.remove_node":
        return await handleRemoveNode(args as unknown as CanvasRemoveNodeArgs, conversationId);
      case "canvas.update_node":
        return await handleUpdateNode(args as unknown as CanvasUpdateNodeArgs, conversationId);
      default:
        return {
          type: "error",
          content: `Unknown tool: ${name}`,
          metadata: { tool: name },
        };
    }
  } catch (err) {
    return {
      type: "error",
      content: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
      metadata: { tool: name },
    };
  }
}

async function handleAddNode(
  args: CanvasAddNodeArgs,
  conversationId: string,
): Promise<AgentOutputChunk> {
  const { type, label, width, height, ...rest } = args;

  const existing = await prisma.canvasNode.findMany({
    where: { conversationId },
    select: { positionX: true, positionY: true, height: true },
  });

  const maxY = existing.length > 0
    ? Math.max(...existing.map((n) => n.positionY + n.height))
    : 0;

  const w = width ?? 340;
  const h = height ?? (type === "text" ? 180 : 280);

  const nodeData: Prisma.InputJsonValue = {
    label,
    nodeType: type,
    width: w,
    height: h,
    ...rest,
  };

  const node = await prisma.canvasNode.create({
    data: {
      conversationId,
      type,
      label: label || "",
      positionX: (existing.length % 2) * 360 + 20,
      positionY: maxY + 30,
      width: w,
      height: h,
      data: nodeData,
    },
  });

  return {
    type: "tool_call",
    name: "canvas.add_node",
    content: `已添加${typeLabel(type)}「${label}」到画布`,
    metadata: {
      conversationId,
      tool: "canvas.add_node",
      result: "success",
      nodeId: node.id,
      nodeType: type,
    },
  };
}

async function handleRemoveNode(
  args: CanvasRemoveNodeArgs,
  conversationId: string,
): Promise<AgentOutputChunk> {
  await prisma.canvasNode.deleteMany({
    where: { id: args.nodeId, conversationId },
  });
  await prisma.canvasEdge.deleteMany({
    where: {
      conversationId,
      OR: [{ sourceNodeId: args.nodeId }, { targetNodeId: args.nodeId }],
    },
  });

  return {
    type: "tool_call",
    name: "canvas.remove_node",
    content: `已从画布移除节点`,
    metadata: {
      conversationId,
      tool: "canvas.remove_node",
      result: "success",
      nodeId: args.nodeId,
    },
  };
}

async function handleUpdateNode(
  args: CanvasUpdateNodeArgs,
  conversationId: string,
): Promise<AgentOutputChunk> {
  const { nodeId, ...patch } = args;
  const existing = await prisma.canvasNode.findFirst({
    where: { id: nodeId, conversationId },
  });
  if (!existing) {
    return {
      type: "error",
      content: `Node ${nodeId} not found`,
      metadata: { tool: "canvas.update_node" },
    };
  }

  const currentData = (existing.data as Record<string, unknown>) || {};
  const newData = { ...currentData, ...patch };
  if (patch.label) newData.label = patch.label;

  await prisma.canvasNode.update({
    where: { id: nodeId },
    data: {
      label: patch.label ?? existing.label,
      data: newData as Prisma.InputJsonValue,
    },
  });

  return {
    type: "tool_call",
    name: "canvas.update_node",
    content: `已更新画布节点`,
    metadata: {
      conversationId,
      tool: "canvas.update_node",
      result: "success",
      nodeId,
    },
  };
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    chart: "股票图表",
    image: "图片",
    pdf: "PDF",
    text: "文本笔记",
  };
  return map[type] || type;
}
