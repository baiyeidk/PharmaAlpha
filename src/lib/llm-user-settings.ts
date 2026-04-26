import { prisma } from "@/lib/db";

type Source = "user" | "env" | "none";

export interface UserLlmSetting {
    apiKey: string | null;
    model: string | null;
    baseUrl: string | null;
    updatedAt: string | null;
}

export interface ResolvedLlmConfig {
    apiKey: string;
    model: string;
    baseUrl: string;
    source: {
        apiKey: Source;
        model: Source;
        baseUrl: Source;
    };
}

let ensureTablePromise: Promise<void> | null = null;

function normalizeNullable(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function ensureTable(): Promise<void> {
    if (!ensureTablePromise) {
        ensureTablePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserLlmSetting" (
        "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
        "apiKey" TEXT,
        "model" TEXT,
        "baseUrl" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined);
    }
    await ensureTablePromise;
}

export async function getUserLlmSetting(userId: string): Promise<UserLlmSetting> {
    await ensureTable();
    const rows = await prisma.$queryRawUnsafe<Array<{
        apiKey: string | null;
        model: string | null;
        baseUrl: string | null;
        updatedAt: Date | null;
    }>>(
        `SELECT "apiKey", "model", "baseUrl", "updatedAt"
     FROM "UserLlmSetting"
     WHERE "userId" = $1
     LIMIT 1`,
        userId
    );

    const row = rows[0];
    if (!row) {
        return { apiKey: null, model: null, baseUrl: null, updatedAt: null };
    }

    return {
        apiKey: normalizeNullable(row.apiKey),
        model: normalizeNullable(row.model),
        baseUrl: normalizeNullable(row.baseUrl),
        updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    };
}

export async function saveUserLlmSetting(
    userId: string,
    input: { apiKey?: string | null; model?: string | null; baseUrl?: string | null }
): Promise<void> {
    await ensureTable();
    const apiKey = normalizeNullable(input.apiKey);
    const model = normalizeNullable(input.model);
    const baseUrl = normalizeNullable(input.baseUrl);

    await prisma.$executeRawUnsafe(
        `INSERT INTO "UserLlmSetting" ("userId", "apiKey", "model", "baseUrl", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT ("userId") DO UPDATE SET
       "apiKey" = EXCLUDED."apiKey",
       "model" = EXCLUDED."model",
       "baseUrl" = EXCLUDED."baseUrl",
       "updatedAt" = NOW()`,
        userId,
        apiKey,
        model,
        baseUrl
    );
}

export async function resolveLlmConfigForUser(
    userId: string,
    defaults?: { defaultModel?: string; defaultBaseUrl?: string; envModel?: string | null }
): Promise<ResolvedLlmConfig> {
    const setting = await getUserLlmSetting(userId);

    const envApiKey = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || "";
    const envBaseUrl = process.env.LLM_BASE_URL || defaults?.defaultBaseUrl || "https://api.deepseek.com";
    const envModel = defaults?.envModel || process.env.LLM_MODEL || defaults?.defaultModel || "deepseek-chat";

    const apiKey = setting.apiKey || envApiKey;
    const baseUrl = setting.baseUrl || envBaseUrl;
    const model = setting.model || envModel;

    return {
        apiKey,
        model,
        baseUrl,
        source: {
            apiKey: setting.apiKey ? "user" : envApiKey ? "env" : "none",
            baseUrl: setting.baseUrl ? "user" : envBaseUrl ? "env" : "none",
            model: setting.model ? "user" : envModel ? "env" : "none",
        },
    };
}
