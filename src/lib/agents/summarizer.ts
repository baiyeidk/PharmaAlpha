/**
 * Automatic conversation history summarizer.
 *
 * When chat history exceeds a token budget threshold,
 * older messages are compressed into a summary via LLM.
 */

const ASCII_COEFF = 0.3;
const NON_ASCII_COEFF = 1.5;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let ascii = 0;
  let nonAscii = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) ascii++;
    else nonAscii++;
  }
  return Math.ceil(ascii * ASCII_COEFF + nonAscii * NON_ASCII_COEFF);
}

export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>
): number {
  return messages.reduce(
    (sum, m) => sum + estimateTokens(m.content || "") + 4,
    0
  );
}

interface SummarizeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

async function getSummarizeConfig(userId?: string): Promise<SummarizeConfig> {
  if (userId) {
    const { resolveLlmConfigForUser } = await import("@/lib/llm-user-settings");
    const resolved = await resolveLlmConfigForUser(userId, {
      defaultBaseUrl: "https://api.deepseek.com",
      defaultModel: "deepseek-chat",
      envModel: process.env.SUMMARY_MODEL || process.env.LLM_MODEL || "deepseek-chat",
    });
    return {
      apiKey: resolved.apiKey,
      baseUrl: resolved.baseUrl,
      model: resolved.model,
    };
  }

  return {
    apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || "",
    baseUrl: process.env.LLM_BASE_URL || "https://api.deepseek.com",
    model: process.env.SUMMARY_MODEL || process.env.LLM_MODEL || "deepseek-chat",
  };
}

const KEEP_RECENT = 4;
const SUMMARY_PROMPT =
  "将以下对话摘要为 500 字以内的中文摘要，保留关键数据和结论。只输出摘要内容，不要加前缀或解释。";

export async function summarizeHistory(
  messages: Array<{ role: string; content: string }>,
  conversationId?: string,
  userId?: string
): Promise<Array<{ role: string; content: string }>> {
  if (messages.length <= KEEP_RECENT) return messages;

  const oldMessages = messages.slice(0, -KEEP_RECENT);
  const recentMessages = messages.slice(-KEEP_RECENT);

  const oldText = oldMessages
    .map((m) => `[${m.role}]: ${m.content}`)
    .join("\n\n");

  const config = await getSummarizeConfig(userId);
  if (!config.apiKey) return messages;

  try {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: SUMMARY_PROMPT },
          { role: "user", content: oldText },
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) return messages;

    const data = await response.json();
    const summary =
      data.choices?.[0]?.message?.content || "（摘要生成失败）";

    saveConversationSummary(summary, conversationId, userId).catch((err) => {
      console.warn("Failed to save conversation summary:", err);
    });

    return [
      {
        role: "system",
        content: `[对话历史摘要] ${summary}`,
      },
      ...recentMessages,
    ];
  } catch {
    return messages;
  }
}

async function saveConversationSummary(
  summary: string,
  conversationId?: string,
  userId?: string
): Promise<void> {
  if (!conversationId || !userId) return;

  const { prisma } = await import("@/lib/db");
  const { embedText } = await import("@/lib/embedding");

  const topics = extractTopics(summary);
  const vec = await embedText(summary);

  if (vec) {
    const vecStr = `[${vec.join(",")}]`;
    await prisma.$queryRawUnsafe(
      `INSERT INTO "ConversationSummary" (id, "conversationId", "userId", summary, topics, embedding, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::text[], $5::vector, NOW(), NOW())
       ON CONFLICT ("conversationId") DO UPDATE SET
         summary = EXCLUDED.summary,
         topics = EXCLUDED.topics,
         embedding = EXCLUDED.embedding,
         "updatedAt" = NOW()`,
      conversationId,
      userId,
      summary,
      topics,
      vecStr
    );
  } else {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "ConversationSummary" (id, "conversationId", "userId", summary, topics, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::text[], NOW(), NOW())
       ON CONFLICT ("conversationId") DO UPDATE SET
         summary = EXCLUDED.summary,
         topics = EXCLUDED.topics,
         "updatedAt" = NOW()`,
      conversationId,
      userId,
      summary,
      topics
    );
  }
}

function extractTopics(summary: string): string[] {
  const keywords = [
    "恒瑞医药", "药明康德", "以岭药业", "江中药业",
    "投资", "分析", "财报", "营收", "利润", "研发",
    "医药", "创新药", "中成药", "估值",
  ];
  return keywords.filter((k) => summary.includes(k)).slice(0, 10);
}
