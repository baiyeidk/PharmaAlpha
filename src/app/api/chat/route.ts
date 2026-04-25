import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { executeAgent, sseEncoder, sseHeaders, getAgentById } from "@/lib/agents";
import { ensureEmployeeContext } from "@/lib/employee-investment";
import type { AgentOutputChunk } from "@/lib/agents";
import { executeCanvasTool } from "@/lib/agents/canvas-tools";
import { getCanvasSystemMessage, getCanvasToolsForLLM } from "@/lib/agents/tool-definitions";
import { estimateMessagesTokens, summarizeHistory } from "@/lib/agents/summarizer";
import { embedTexts } from "@/lib/embedding";

export const runtime = "nodejs";

const HISTORY_LOAD_LIMIT = 50;
const MIN_CONTENT_FOR_EXTRACTION = 50;
const MEMORY_MAX_PER_USER = 200;

async function loadHistoryFromDB(conversationId: string) {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LOAD_LIMIT,
    select: { role: true, content: true },
  });
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
}

// ── LLM-based Memory Extraction ──────────────────────────────

interface MemoryItem {
  category: "entity" | "conclusion" | "preference" | "event";
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
}

const EXTRACT_PROMPT = `你是一个记忆提取助手。从以下助手回复中提取结构化记忆，以JSON数组返回。

规则：
1. 只提取有价值的、明确的信息，不要编造
2. category 必须是: entity(实体/标的)、conclusion(分析结论)、preference(用户偏好)、event(事件)
3. subject 是主体名称（如公司名、药品名）
4. predicate 是关系/属性（如"股票代码"、"投资评级"、"营收情况"）
5. object 是具体的值或描述
6. confidence 是置信度 0.0-1.0

输出格式（纯JSON数组，不要markdown包裹）：
[{"category":"entity","subject":"恒瑞医药","predicate":"股票代码","object":"600276","confidence":0.95}]

如果没有值得提取的信息，返回空数组 []`;

async function extractMemoryWithLLM(
  content: string,
  userId: string,
  conversationId: string
): Promise<void> {
  if (content.length < MIN_CONTENT_FOR_EXTRACTION) return;

  const apiKey = process.env.LLM_API_KEY || "";
  const baseUrl = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "deepseek-chat";

  let items: MemoryItem[];
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          { role: "user", content: content.slice(0, 4000) },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      console.warn(`[memory] LLM extraction error: ${resp.status}`);
      return;
    }

    const json = await resp.json();
    const raw = json.choices?.[0]?.message?.content?.trim() || "[]";
    const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    items = JSON.parse(cleaned);

    if (!Array.isArray(items)) return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[memory] extraction skipped: ${msg}`);
    return;
  }

  const validItems = items.filter(
    (it) =>
      it.subject &&
      it.object &&
      ["entity", "conclusion", "preference", "event"].includes(it.category)
  );

  if (!validItems.length) return;

  const textsToEmbed = validItems.map(
    (it) => `${it.subject} ${it.predicate || ""} ${it.object}`.trim()
  );
  const embeddings = await embedTexts(textsToEmbed);

  for (let i = 0; i < validItems.length; i++) {
    const item = validItems[i];
    const vec = embeddings[i];

    try {
      if (vec) {
        const vecStr = `[${vec.join(",")}]`;
        await prisma.$queryRawUnsafe(
          `INSERT INTO "MemoryNode" (id, "userId", category, subject, predicate, object, confidence, source, embedding, "accessCount", "lastAccessAt", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8::vector, 0, NOW(), NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          userId,
          item.category,
          item.subject,
          item.predicate || "",
          item.object,
          item.confidence || 1.0,
          conversationId,
          vecStr
        );
      } else {
        await prisma.$queryRawUnsafe(
          `INSERT INTO "MemoryNode" (id, "userId", category, subject, predicate, object, confidence, source, "accessCount", "lastAccessAt", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 0, NOW(), NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          userId,
          item.category,
          item.subject,
          item.predicate || "",
          item.object,
          item.confidence || 1.0,
          conversationId
        );
      }
    } catch (err) {
      console.warn(`Failed to write MemoryNode for ${item.subject}:`, err);
    }
  }

  const count: Array<{ count: bigint }> = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as count FROM "MemoryNode" WHERE "userId" = $1`,
    userId
  );
  const total = Number(count[0]?.count || 0);
  if (total > MEMORY_MAX_PER_USER) {
    await prisma.$queryRawUnsafe(
      `DELETE FROM "MemoryNode" WHERE id IN (
         SELECT id FROM "MemoryNode" WHERE "userId" = $1
         ORDER BY "lastAccessAt" ASC, "accessCount" ASC
         LIMIT $2
       )`,
      userId,
      total - MEMORY_MAX_PER_USER
    );
  }
}

export async function POST(req: Request) {
  const debugId = req.headers.get("x-chat-debug-id") || crypto.randomUUID();
  console.info(`[api/chat] request received debugId=${debugId}`);
  const session = await getSession();
  if (!session?.id) {
    console.warn(`[api/chat] unauthorized debugId=${debugId}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { agentId } = body;
  console.info(
    `[api/chat] payload debugId=${debugId} user=${session.id} agentId=${agentId || "none"} conversationId=${body.conversationId || "new"}`
  );

  if (!agentId) {
    console.warn(`[api/chat] missing agentId debugId=${debugId}`);
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 }
    );
  }

  const agent = await getAgentById(agentId);
  if (!agent || !agent.enabled) {
    console.warn(`[api/chat] agent not found or disabled debugId=${debugId}: ${agentId}`);
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // ── Resolve messages: server-load (newMessage) or legacy (messages[]) ──
  const isServerLoad = typeof body.newMessage === "string";
  let messages: Array<{ role: string; content: string }>;
  let convId: string | undefined = body.conversationId;

  if (isServerLoad) {
    if (convId) {
      messages = await loadHistoryFromDB(convId);
    } else {
      messages = [];
    }
    messages.push({ role: "user", content: body.newMessage });
  } else {
    messages = body.messages;
    if (!messages?.length) {
      return NextResponse.json(
        { error: "messages or newMessage is required" },
        { status: 400 }
      );
    }
  }

  if (!convId) {
    const lastContent = messages[messages.length - 1]?.content || "New Chat";
    const conv = await prisma.conversation.create({
      data: {
        title: lastContent.slice(0, 100),
        userId: session.id,
      },
    });
    convId = conv.id;
  }

  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg && lastUserMsg.role === "user") {
    await prisma.message.create({
      data: {
        role: "user",
        content: lastUserMsg.content,
        conversationId: convId,
        agentId: agent.id,
      },
    });
  }

  // ── Auto-summarize long history ──
  const TOKEN_BUDGET = parseInt(process.env.CONTEXT_BUDGET_TOKENS || "40000", 10);
  const SUMMARIZE_THRESHOLD = TOKEN_BUDGET * 0.5;

  if (estimateMessagesTokens(messages) > SUMMARIZE_THRESHOLD) {
    const cached = messages.find(
      (m) => m.role === "system" && (m as Record<string, unknown>).content?.toString().startsWith("[对话历史摘要]")
    );
    if (!cached) {
      messages = await summarizeHistory(messages, convId, session.id);
    }
  }

  const isPECAgent = agent.name === "supervisor_agent";

  const agentMessages = isPECAgent
    ? [...messages]
    : [{ role: "system", content: getCanvasSystemMessage() }, ...messages];

  const employeeContext =
    agent.name === "employee_investment_team"
      ? await ensureEmployeeContext(session)
      : null;

  let agentParams: Record<string, unknown> = {};
  if (employeeContext) {
    agentParams.employee_id = employeeContext.employeeCode;
  }

  if (isPECAgent && convId) {
    const canvasNodes = await prisma.canvasNode.findMany({
      where: { conversationId: convId },
      select: { type: true, label: true, data: true },
    });
    if (canvasNodes.length > 0) {
      agentParams.canvas_nodes = canvasNodes.map((n) => ({
        type: n.type,
        label: n.label,
        tickers: (n.data as Record<string, unknown>)?.tickers,
      }));
    }
  }

  const agentStream = executeAgent(
    agent.entryPoint,
    {
      action: "chat",
      messages: agentMessages,
      session_id: convId,
      ...(isPECAgent ? {} : { tools: getCanvasToolsForLLM() }),
      params: Object.keys(agentParams).length > 0 ? agentParams : undefined,
    },
    isPECAgent ? { extraEnv: { MEMORY_USER_ID: session.id } } : {}
  );

  const chunks: string[] = [];

  const captureAndForward = new TransformStream<AgentOutputChunk, AgentOutputChunk>({
    async transform(chunk, controller) {
      if (chunk.type === "tool_call" && chunk.name?.startsWith("canvas.")) {
        const result = await executeCanvasTool(chunk, convId!);
        controller.enqueue({ ...result, metadata: { ...result.metadata, conversationId: convId } });
        return;
      }

      const passthroughTypes = new Set([
        "tool_start", "tool_result", "plan", "check",
        "agent_chunk", "agent_delegate", "agent_result",
        "phase_start", "phase_end",
      ]);
      if (passthroughTypes.has(chunk.type)) {
        controller.enqueue({ ...chunk, metadata: { ...chunk.metadata, conversationId: convId } });
        return;
      }

      if ((chunk.type === "chunk" || chunk.type === "result") && chunk.content) {
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
            conversationId: convId!,
            agentId: agent.id,
          },
        });
        if (isPECAgent) {
          extractMemoryWithLLM(fullContent, session!.id, convId!).catch((err) => {
            console.warn("Async memory extraction failed:", err);
          });
        }
      }
    },
  });

  const responseBody = agentStream
    .pipeThrough(captureAndForward)
    .pipeThrough(sseEncoder());

  console.info(`[api/chat] stream started debugId=${debugId} user=${session.id} agent=${agent.name} conversationId=${convId}`);
  return new Response(responseBody, { headers: sseHeaders() });
}
