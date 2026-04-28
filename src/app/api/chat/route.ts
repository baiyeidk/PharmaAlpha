import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { executeAgent, sseEncoder, sseHeaders, getAgentById } from "@/lib/agents";
import { ensureEmployeeContext, getProjectConversationAccess } from "@/lib/employee-investment";
import type { AgentOutputChunk } from "@/lib/agents";
import { executeCanvasTool } from "@/lib/agents/canvas-tools";
import { getCanvasSystemMessage, getCanvasToolsForLLM } from "@/lib/agents/tool-definitions";
import { estimateMessagesTokens, summarizeHistory } from "@/lib/agents/summarizer";
import { embedTexts } from "@/lib/embedding";
import { resolveEmbeddingConfigForUser, resolveLlmConfigForUser } from "@/lib/llm-user-settings";

export const runtime = "nodejs";

const HISTORY_LOAD_LIMIT = 50;
const MIN_CONTENT_FOR_EXTRACTION = 50;
const MEMORY_MAX_PER_USER = 200;
const MEMORY_EXTRACTION_TIMEOUT_MS = 8_000;

async function loadHistoryFromDB(conversationId: string) {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LOAD_LIMIT,
    select: { role: true, content: true },
  });
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
}

type ProjectConversationAccess = NonNullable<
  Awaited<ReturnType<typeof getProjectConversationAccess>>
>;

async function buildProjectContextMessage(access: ProjectConversationAccess) {
  const projectId = access.conversation.investmentProjectId;
  if (!projectId) return null;

  const project = await prisma.investmentProject.findUnique({
    where: { id: projectId },
    include: {
      members: {
        where: { status: "active" },
        orderBy: [{ isInitiator: "desc" }, { joinedAt: "asc" }],
        include: {
          employeeProfile: {
            select: {
              employeeCode: true,
              displayName: true,
              title: true,
              department: true,
            },
          },
        },
      },
      artifacts: {
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          artifactType: true,
          title: true,
          content: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!project) return null;

  const members = project.members
    .map((member) => {
      const employee = member.employeeProfile;
      return `${employee.displayName}(${employee.employeeCode}, ${employee.title}, ${employee.department})`;
    })
    .join("; ");
  const artifacts = project.artifacts
    .map((artifact) => {
      const content = artifact.content.replace(/\s+/g, " ").slice(0, 800);
      return `- ${artifact.title} [${artifact.artifactType}, ${artifact.id}, ${artifact.updatedAt.toISOString()}]: ${content}`;
    })
    .join("\n");

  return [
    "[Project Context]",
    `Project ID: ${project.id}`,
    `Project Code: ${project.projectCode}`,
    `Title: ${project.title}`,
    `Topic: ${project.topic}`,
    project.objective ? `Objective: ${project.objective}` : null,
    project.priority ? `Priority: ${project.priority}` : null,
    members ? `Members: ${members}` : "Members: none",
    artifacts ? `Recent Artifacts:\n${artifacts}` : "Recent Artifacts: none",
    "Instruction: Treat project artifacts as durable project context. When producing reusable conclusions, name the artifact that should be saved or updated.",
  ]
    .filter(Boolean)
    .join("\n");
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

  const config = await resolveLlmConfigForUser(userId, {
    // Keep extraction LLM defaults consistent with chat-agent runtime defaults.
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
  });
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl;
  const model = config.model;

  if (!apiKey) {
    console.warn("[memory] extraction skipped: no API key resolved");
    return;
  }

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

  const embeddingConfig = await resolveEmbeddingConfigForUser(userId);
  const textsToEmbed = validItems.map(
    (it) => `${it.subject} ${it.predicate || ""} ${it.object}`.trim()
  );
  const embeddings = await embedTexts(textsToEmbed, {
    provider: embeddingConfig.provider,
    apiKey: embeddingConfig.apiKey,
    baseUrl: embeddingConfig.baseUrl,
    model: embeddingConfig.model,
    dimensions: embeddingConfig.dimensions,
  });

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
  let conversationAccess: Awaited<ReturnType<typeof getProjectConversationAccess>> | null = null;

  if (isServerLoad) {
    if (convId) {
      const access = await getProjectConversationAccess(session, convId);
      if (!access) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      conversationAccess = access;
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
    if (convId) {
      const access = await getProjectConversationAccess(session, convId);
      if (!access) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      conversationAccess = access;
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
  const projectContextMessage =
    agent.name === "employee_investment_team" && conversationAccess?.conversation.investmentProjectId
      ? await buildProjectContextMessage(conversationAccess)
      : null;

  const agentMessages = isPECAgent
    ? [...messages]
    : [
      { role: "system", content: getCanvasSystemMessage() },
      ...(projectContextMessage ? [{ role: "system", content: projectContextMessage }] : []),
      ...messages,
    ];

  const employeeContext =
    agent.name === "employee_investment_team"
      ? await ensureEmployeeContext(session)
      : null;

  const agentParams: Record<string, unknown> = {};
  if (employeeContext) {
    agentParams.employee_id = employeeContext.employeeCode;
  }
  const projectAccess = conversationAccess?.projectAccess;
  if (projectContextMessage && projectAccess?.project) {
    agentParams.project_id = projectAccess.project.id;
    agentParams.project_code = projectAccess.project.projectCode;
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

  const llmConfig = await resolveLlmConfigForUser(session.id, {
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
  });
  const embeddingConfig = await resolveEmbeddingConfigForUser(session.id);
  const agentExtraEnv: Record<string, string> = {
    MEMORY_USER_ID: session.id,
    AGENT_USER_ID: session.id,
  };
  if (session.email) {
    agentExtraEnv.AGENT_USER_EMAIL = session.email;
  }
  if (llmConfig.apiKey) {
    agentExtraEnv.LLM_API_KEY = llmConfig.apiKey;
    agentExtraEnv.DEEPSEEK_API_KEY = llmConfig.apiKey;
  }
  if (llmConfig.baseUrl) {
    agentExtraEnv.LLM_BASE_URL = llmConfig.baseUrl;
  }
  if (llmConfig.model) {
    agentExtraEnv.LLM_MODEL = llmConfig.model;
  }
  if (embeddingConfig.apiKey) {
    agentExtraEnv.EMBEDDING_API_KEY = embeddingConfig.apiKey;
  }
  if (embeddingConfig.baseUrl) {
    agentExtraEnv.EMBEDDING_BASE_URL = embeddingConfig.baseUrl;
  }
  if (embeddingConfig.model) {
    agentExtraEnv.EMBEDDING_MODEL = embeddingConfig.model;
  }
  if (embeddingConfig.provider) {
    agentExtraEnv.EMBEDDING_PROVIDER = embeddingConfig.provider;
  }
  if (Number.isFinite(embeddingConfig.dimensions)) {
    agentExtraEnv.EMBEDDING_DIMENSIONS = String(embeddingConfig.dimensions);
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
    { extraEnv: agentExtraEnv }
  );

  const chunks: string[] = [];
  // Accumulate ALL errors instead of overwriting; this preserves diagnostic
  // context when the agent emits multiple errors (e.g. plan ok, execute fails,
  // synthesize fails again).
  const errors: Array<{
    code: string;
    content: string;
    phase?: string;
    details?: Record<string, unknown>;
  }> = [];

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
        "phase_start", "phase_end", "timing", "token_usage",
        "agent_log",
      ]);
      if (passthroughTypes.has(chunk.type)) {
        controller.enqueue({ ...chunk, metadata: { ...chunk.metadata, conversationId: convId } });
        return;
      }

      if ((chunk.type === "chunk" || chunk.type === "result") && chunk.content) {
        chunks.push(chunk.content);
      }
      if (chunk.type === "error" && (chunk.content || chunk.code)) {
        errors.push({
          code: chunk.code || "AGENT_ERROR",
          content: chunk.content || "",
          phase: chunk.phase,
          details: chunk.details,
        });
        if (chunk.code) {
          console.warn(
            `[api/chat] agent error debugId=${debugId} code=${chunk.code} phase=${chunk.phase || "?"}: ${(chunk.content || "").slice(0, 200)}`,
          );
        }
      }
      controller.enqueue({ ...chunk, metadata: { ...chunk.metadata, conversationId: convId } });
    },
    async flush() {
      const fullContent = chunks.join("");

      // Build the persisted assistant message:
      //   - If we got real content: keep it, append a footer noting any errors
      //     (so the user can still browse what worked and see what broke).
      //   - If we got nothing but errors: persist a structured error message
      //     instead of a single naked "Error: ..." line.
      let persistedContent: string | null = null;
      if (fullContent && errors.length === 0) {
        persistedContent = fullContent;
      } else if (fullContent && errors.length > 0) {
        const footer = errors
          .map(
            (e) =>
              `- [${e.code}${e.phase ? ` @ ${e.phase}` : ""}] ${e.content}`,
          )
          .join("\n");
        persistedContent = `${fullContent}\n\n---\n[Agent reported ${errors.length} error(s) during this turn]\n${footer}`;
      } else if (errors.length > 0) {
        const lines = errors
          .map(
            (e) =>
              `[${e.code}${e.phase ? ` @ ${e.phase}` : ""}] ${e.content}`,
          )
          .join("\n");
        persistedContent = `Agent failed without producing visible output:\n${lines}`;
      }

      if (persistedContent) {
        try {
          await prisma.message.create({
            data: {
              role: "assistant",
              content: persistedContent,
              conversationId: convId!,
              agentId: agent.id,
            },
          });
        } catch (err) {
          // Don't let a DB failure swallow the entire response stream — log
          // and continue. The user already received the agent output.
          console.error(`[api/chat] failed to persist assistant message debugId=${debugId}:`, err);
        }
        if (isPECAgent && fullContent) {
          try {
            await Promise.race([
              extractMemoryWithLLM(fullContent, session!.id, convId!),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("memory extraction timeout")), MEMORY_EXTRACTION_TIMEOUT_MS)
              ),
            ]);
          } catch (err) {
            console.warn("Memory extraction failed or timed out:", err);
          }
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
