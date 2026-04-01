// ─── Agent Types ────────────────────────────────────────────

export interface AgentConfig {
  name: string;
  displayName: string;
  description: string;
  entryPoint: string;
  version?: string;
  capabilities?: string[];
}

export interface AgentInput {
  action: string;
  session_id?: string;
  messages: ChatMessage[];
  params?: Record<string, unknown>;
}

export interface AgentOutputChunk {
  type: "chunk" | "tool_call" | "result" | "error";
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}
