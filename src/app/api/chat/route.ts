import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { executeAgent, sseEncoder, sseHeaders, getAgentById } from "@/lib/agents";
import { ensureEmployeeContext } from "@/lib/employee-investment";
import type { AgentOutputChunk } from "@/lib/agents";
import { executeCanvasTool } from "@/lib/agents/canvas-tools";
import { getCanvasSystemMessage, getCanvasToolsForLLM } from "@/lib/agents/tool-definitions";

export const runtime = "nodejs";

async function searchRAGKnowledge(query: string, userId: string, topK: number = 3) {
  try {
    const documents = await prisma.rAGDocument.findMany({
      where: { userId },
      include: {
        chunks: true,
      },
    });

    const allChunks = documents.flatMap(doc =>
      doc.chunks.map(chunk => ({
        ...chunk,
        documentTitle: doc.title,
        documentSource: doc.source,
      }))
    );

    const queryLower = query.toLowerCase();
    const scoredChunks = allChunks.map(chunk => {
      const score = calculateRelevanceScore(queryLower, chunk.content);
      return { ...chunk, score };
    });

    const topChunks = scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(chunk => chunk.score > 0)
      .map(({ score, ...rest }) => rest);

    return topChunks;
  } catch (error) {
    console.error("RAG search error:", error);
    return [];
  }
}

function calculateRelevanceScore(query: string, content: string): number {
  const contentLower = content.toLowerCase();
  const queryWords = query.split(/\s+/).filter(w => w.length > 2);

  let score = 0;
  let matchedWords = 0;

  for (const queryWord of queryWords) {
    if (contentLower.includes(queryWord)) {
      matchedWords++;
      score += 1;

      const exactMatches = (contentLower.match(new RegExp(queryWord, 'g')) || []).length;
      score += exactMatches * 0.5;
    }
  }

  if (matchedWords > 0) {
    score += (matchedWords / queryWords.length) * 2;
  }

  return score;
}

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

  const ragResults = await searchRAGKnowledge(lastUserMsg?.content || "", session.id);
  let ragSystemMsg;
  if (ragResults.length > 0) {
    const ragContext = ragResults.map((result, idx) => 
      `[文档${idx + 1}] 标题: ${result.documentTitle}\n来源: ${result.documentSource || '未知'}\n内容: ${result.content}`
    ).join('\n\n');
    
    ragSystemMsg = {
      role: "system",
      content: `以下是相关知识库内容，请在回答时参考这些信息：\n\n${ragContext}\n\n请基于以上知识库信息回答用户问题，如果知识库中没有相关信息，请基于你的知识回答。`,
    };
  }

  const messagesWithTools = ragSystemMsg 
    ? [ragSystemMsg, toolSystemMsg, ...messages]
    : [toolSystemMsg, ...messages];

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
      ? { 
          employee_id: employeeContext.employeeCode,
          rag_context: ragResults.length > 0 ? ragResults : undefined
        }
      : { rag_context: ragResults.length > 0 ? ragResults : undefined },
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
