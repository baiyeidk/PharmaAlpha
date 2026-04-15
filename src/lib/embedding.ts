/**
 * Unified embedding provider for TypeScript (route handlers).
 * Mirrors the Python agents/base/embedding.py abstraction.
 */

const TIMEOUT_MS = 30_000;
const BATCH_LIMIT = 10;
const DEFAULT_DIMENSIONS = 1024;

interface EmbeddingProvider {
  embed(texts: string[]): Promise<(number[] | null)[]>;
}

function getConfig() {
  return {
    provider: process.env.EMBEDDING_PROVIDER || "openai",
    apiKey: process.env.EMBEDDING_API_KEY || process.env.LLM_API_KEY || "",
    baseUrl:
      process.env.EMBEDDING_BASE_URL ||
      process.env.LLM_BASE_URL ||
      "https://api.openai.com/v1",
    model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    dimensions: parseInt(
      process.env.EMBEDDING_DIMENSIONS || String(DEFAULT_DIMENSIONS),
      10
    ),
  };
}

async function openaiEmbed(
  texts: string[],
  config: ReturnType<typeof getConfig>
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const resp = await fetch(`${config.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          input: batch,
          dimensions: config.dimensions,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "unknown error");
        console.warn(`Embedding API error (${resp.status}): ${errText}`);
        results.push(...batch.map(() => null));
        continue;
      }

      const json = await resp.json();
      for (const item of json.data) {
        results.push(item.embedding as number[]);
      }
    } catch (err) {
      console.warn("Embedding batch failed:", err);
      results.push(...batch.map(() => null));
    }
  }

  return results;
}

function resolveBaseUrl(provider: string): string {
  const config = getConfig();
  if (process.env.EMBEDDING_BASE_URL) return config.baseUrl;

  switch (provider) {
    case "dashscope":
      return "https://dashscope.aliyuncs.com/compatible-mode/v1";
    case "zhipu":
      return "https://open.bigmodel.cn/api/paas/v4/";
    default:
      return config.baseUrl;
  }
}

function resolveModel(provider: string): string {
  if (process.env.EMBEDDING_MODEL) return process.env.EMBEDDING_MODEL;

  switch (provider) {
    case "dashscope":
      return "text-embedding-v4";
    case "zhipu":
      return "embedding-3";
    default:
      return "text-embedding-3-small";
  }
}

let _cached: EmbeddingProvider | null = null;

function getEmbeddingProvider(): EmbeddingProvider {
  if (_cached) return _cached;

  const config = getConfig();
  const provider = config.provider.toLowerCase();

  if (provider === "local") {
    console.warn(
      "Local embedding not supported on TS side; falling back to API-based."
    );
  }

  const resolved = {
    ...config,
    baseUrl: resolveBaseUrl(provider),
    model: resolveModel(provider),
  };

  _cached = {
    embed: (texts: string[]) => openaiEmbed(texts, resolved),
  };

  return _cached;
}

/**
 * Convenience: embed a list of texts using the configured provider.
 * Returns null for any text that failed to embed.
 */
export async function embedTexts(
  texts: string[]
): Promise<(number[] | null)[]> {
  return getEmbeddingProvider().embed(texts);
}

/**
 * Convenience: embed a single text.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const results = await embedTexts([text]);
  return results[0] ?? null;
}

export { getEmbeddingProvider, type EmbeddingProvider };
