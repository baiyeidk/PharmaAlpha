import {
  executeAgent,
  getAgentByName,
  syncAgentsToDatabase,
  type AgentInput,
  type AgentOutputChunk,
} from "@/lib/agents";
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

  const stream = executeAgent(agent.entryPoint, {
    ...input,
    params: {
      ...input.params,
      employee_id: employee.employeeCode,
    },
  });

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
