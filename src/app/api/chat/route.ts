import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { executeAgent, sseEncoder, sseHeaders, getAgentById } from "@/lib/agents";
import { ensureEmployeeContext } from "@/lib/employee-investment";
import type { AgentOutputChunk } from "@/lib/agents";
import { executeCanvasTool } from "@/lib/agents/canvas-tools";
import { getCanvasSystemMessage, getCanvasToolsForLLM } from "@/lib/agents/tool-definitions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, messages, conversationId } = await req.json();

  if (!agentId || !messages?.length) {
    return NextResponse.json(
      { error: "agentId and messages are required" },
      { status: 400 }
    );
  }

  const agent = await getAgentById(agentId);
  if (!agent || !agent.enabled) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let convId = conversationId;
  if (!convId) {
    const userMessage = messages[messages.length - 1]?.content || "New Chat";
    const conv = await prisma.conversation.create({
      data: {
        title: userMessage.slice(0, 100),
        userId: session.id,
      },
    });
    convId = conv.id;
  }

  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg) {
    await prisma.message.create({
      data: {
        role: lastUserMsg.role || "user",
        content: lastUserMsg.content,
        conversationId: convId,
        agentId: agent.id,
      },
    });
  }

  const toolSystemMsg = {
    role: "system",
    content: getCanvasSystemMessage(),
  };
  const messagesWithTools = [toolSystemMsg, ...messages];
  const employeeContext =
    agent.name === "employee_investment_team"
      ? await ensureEmployeeContext(session)
      : null;

  const agentStream = executeAgent(agent.entryPoint, {
    action: "chat",
    messages: messagesWithTools,
    session_id: convId,
    tools: getCanvasToolsForLLM(),
    params: employeeContext
      ? { employee_id: employeeContext.employeeCode }
      : undefined,
  });

  const chunks: string[] = [];
  const toolCallPattern = /\{"type"\s*:\s*"tool_call"\s*,\s*"name"\s*:\s*"(canvas\.[^"]+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\s*\}/g;

  async function handleToolCall(tc: AgentOutputChunk): Promise<AgentOutputChunk> {
    const result = await executeCanvasTool(tc, convId);
    return { ...result, metadata: { ...result.metadata, conversationId: convId } };
  }

  const captureAndForward = new TransformStream<AgentOutputChunk, AgentOutputChunk>({
    async transform(chunk, controller) {
      if (chunk.type === "tool_call" && chunk.name?.startsWith("canvas.")) {
        controller.enqueue(await handleToolCall(chunk));
        return;
      }

      if ((chunk.type === "chunk" || chunk.type === "result") && chunk.content) {
        const text = chunk.content;
        const matches = [...text.matchAll(toolCallPattern)];

        if (matches.length > 0) {
          let cleanText = text;
          for (const match of matches) {
            cleanText = cleanText.replace(match[0], "");
            try {
              const parsed = JSON.parse(match[0]) as AgentOutputChunk;
              controller.enqueue(await handleToolCall(parsed));
            } catch { /* skip malformed */ }
          }
          const trimmed = cleanText.trim();
          if (trimmed) {
            chunks.push(trimmed);
            controller.enqueue({ ...chunk, content: trimmed, metadata: { ...chunk.metadata, conversationId: convId } });
          }
        } else {
          chunks.push(text);
          controller.enqueue({ ...chunk, metadata: { ...chunk.metadata, conversationId: convId } });
        }
      } else {
        controller.enqueue({ ...chunk, metadata: { ...chunk.metadata, conversationId: convId } });
      }
    },
    async flush() {
      const fullContent = chunks.join("");
      if (fullContent) {
        await prisma.message.create({
          data: {
            role: "assistant",
            content: fullContent,
            conversationId: convId,
            agentId: agent.id,
          },
        });
      }
    },
  });

  const body = agentStream
    .pipeThrough(captureAndForward)
    .pipeThrough(sseEncoder());

  return new Response(body, { headers: sseHeaders() });
}
