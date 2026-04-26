import {
  executeAgent,
  getAgentByName,
  syncAgentsToDatabase,
  type AgentInput,
  type AgentOutputChunk,
} from "@/lib/agents";
import { resolveEmbeddingConfigForUser, resolveLlmConfigForUser } from "@/lib/llm-user-settings";
import { ensureEmployeeContext } from "./context";
import type { AgentInvocationResult } from "./types";
import type { SessionUser } from "@/lib/auth";

const EMPLOYEE_AGENT_NAME = "employee_investment_team";

async function getEmployeeInvestmentAgent() {
  await syncAgentsToDatabase();
  const agent = await getAgentByName(EMPLOYEE_AGENT_NAME);
  if (!agent || !agent.enabled) {
    throw new Error("Employee investment agent is not available");
  }
  return agent;
}

export async function invokeEmployeeInvestmentAgent<T = Record<string, unknown>>(
  session: SessionUser,
  input: Omit<AgentInput, "params"> & { params?: Record<string, unknown> }
): Promise<AgentInvocationResult<T>> {
  const [agent, employee] = await Promise.all([
    getEmployeeInvestmentAgent(),
    ensureEmployeeContext(session),
  ]);

  const [llmConfig, embeddingConfig] = await Promise.all([
    resolveLlmConfigForUser(session.id, {
      defaultBaseUrl: "https://api.deepseek.com",
      defaultModel: "deepseek-chat",
    }),
    resolveEmbeddingConfigForUser(session.id),
  ]);

  const extraEnv: Record<string, string> = {
    AGENT_USER_ID: session.id,
    MEMORY_USER_ID: session.id,
  };
  if (session.email) {
    extraEnv.AGENT_USER_EMAIL = session.email;
  }
  if (llmConfig.apiKey) {
    extraEnv.LLM_API_KEY = llmConfig.apiKey;
    extraEnv.DEEPSEEK_API_KEY = llmConfig.apiKey;
  }
  if (llmConfig.baseUrl) {
    extraEnv.LLM_BASE_URL = llmConfig.baseUrl;
  }
  if (llmConfig.model) {
    extraEnv.LLM_MODEL = llmConfig.model;
  }
  if (embeddingConfig.apiKey) {
    extraEnv.EMBEDDING_API_KEY = embeddingConfig.apiKey;
  }
  if (embeddingConfig.baseUrl) {
    extraEnv.EMBEDDING_BASE_URL = embeddingConfig.baseUrl;
  }
  if (embeddingConfig.model) {
    extraEnv.EMBEDDING_MODEL = embeddingConfig.model;
  }
  if (embeddingConfig.provider) {
    extraEnv.EMBEDDING_PROVIDER = embeddingConfig.provider;
  }
  if (Number.isFinite(embeddingConfig.dimensions)) {
    extraEnv.EMBEDDING_DIMENSIONS = String(embeddingConfig.dimensions);
  }

  const stream = executeAgent(
    agent.entryPoint,
    {
      ...input,
      params: {
        ...input.params,
        employee_id: employee.employeeCode,
      },
    },
    { extraEnv }
  );

  const reader = stream.getReader();
  const chunks: string[] = [];
  let resultMetadata: T | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = value as AgentOutputChunk;
    if (chunk.type === "error") {
      throw new Error(chunk.content || chunk.code || "Agent request failed");
    }
    if (chunk.type === "chunk" && chunk.content) {
      chunks.push(chunk.content);
    }
    if (chunk.type === "result") {
      if (chunk.content) {
        chunks.push(chunk.content);
      }
      resultMetadata = (chunk.metadata as T | undefined) ?? null;
    }
  }

  return {
    text: chunks.join(""),
    metadata: resultMetadata,
  };
}
