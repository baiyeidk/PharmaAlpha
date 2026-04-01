import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { executeAgent, sseEncoder, sseHeaders, getAgentById } from "@/lib/agents";
import type { AgentOutputChunk } from "@/lib/agents";

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

  const agentStream = executeAgent(agent.entryPoint, {
    action: "chat",
    messages,
    session_id: convId,
  });

  const chunks: string[] = [];

  const captureAndForward = new TransformStream<AgentOutputChunk, AgentOutputChunk>({
    transform(chunk, controller) {
      if (chunk.type === "chunk" && chunk.content) {
        chunks.push(chunk.content);
      } else if (chunk.type === "result" && chunk.content) {
        chunks.push(chunk.content);
      }
      controller.enqueue({ ...chunk, metadata: { ...chunk.metadata, conversationId: convId } });
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
