export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentInput {
  action: string;
  session_id?: string;
  messages: Array<{
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  params?: Record<string, unknown>;
  tools?: ToolSchema[];
}

export interface AgentOutputChunk {
  type:
    | "chunk"
    | "tool_call"
    | "result"
    | "error"
    | "tool_start"
    | "tool_result"
    | "plan"
    | "check"
    | "agent_chunk"
    | "agent_delegate"
    | "agent_result"
    | "phase_start"
    | "phase_end"
    | "timing"
    | "token_usage";
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  code?: string;
  result?: string;
  success?: boolean;
  steps?: Array<Record<string, unknown>>;
  reasoning?: string;
  passed?: boolean;
  summary?: string;
  gaps?: string[];
  action?: string;
  agent_name?: string;
  task?: string;
  phase?: string;
  round?: number;
  elapsed_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cached_tokens?: number;
}

export interface AgentMeta {
  name: string;
  displayName: string;
  description: string;
  entryPoint: string;
  version?: string;
  capabilities?: string[];
}
