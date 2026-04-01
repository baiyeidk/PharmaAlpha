export interface AgentInput {
  action: string;
  session_id?: string;
  messages: Array<{
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  params?: Record<string, unknown>;
}

export interface AgentOutputChunk {
  type: "chunk" | "tool_call" | "result" | "error";
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  code?: string;
}

export interface AgentMeta {
  name: string;
  displayName: string;
  description: string;
  entryPoint: string;
  version?: string;
  capabilities?: string[];
}
