## ADDED Requirements

### Requirement: LLM native function calling via OpenAI tools parameter
Agent SHALL pass tool schemas to the LLM via the OpenAI `tools` parameter and parse structured `tool_calls` from the response, replacing the system-prompt-based text extraction approach for new agents.

#### Scenario: LLM returns a single tool call
- **WHEN** LLM response contains a `tool_calls` array with one entry (function name + arguments JSON)
- **THEN** agent parses the tool call, executes the corresponding registered tool, and appends the result as a `tool` role message before calling LLM again

#### Scenario: LLM returns multiple tool calls
- **WHEN** LLM response contains a `tool_calls` array with multiple entries
- **THEN** agent executes all tool calls (sequentially or in parallel per configuration), appends all results as `tool` role messages, and calls LLM again with the full context

#### Scenario: LLM returns plain text (no tool calls)
- **WHEN** LLM response contains `content` but no `tool_calls`
- **THEN** agent streams the text as `AgentChunk` events and finishes with an `AgentResult`

### Requirement: Tool execution loop with streaming output
Agent SHALL implement a loop that alternates between LLM calls and tool executions, streaming intermediate outputs to the user via JSON Lines protocol throughout the loop.

#### Scenario: Multi-step tool use chain
- **WHEN** LLM uses tool A, then based on tool A's result uses tool B, then generates a final text response
- **THEN** agent yields `tool_start` → `tool_result` → `tool_start` → `tool_result` → streaming `AgentChunk` → `AgentResult`, all within a single agent execution

#### Scenario: Maximum loop iterations exceeded
- **WHEN** the tool loop exceeds the configured maximum iterations (default 10)
- **THEN** agent yields an `AgentError` with code `TOOL_LOOP_LIMIT` and a message explaining the limit was reached

### Requirement: Tool execution events visible to user
Agent SHALL emit `tool_start` events before executing a tool and `tool_result` events after execution. Both events MUST be forwarded to the frontend so users can see what tools are being called and what results are returned.

#### Scenario: Tool start notification visible to user
- **WHEN** agent begins executing a tool call from the LLM
- **THEN** agent yields `{"type":"tool_start","name":"<tool_name>","args":{...}}` which the frontend renders as a progress indicator (e.g. "正在查询 600276 行情...")

#### Scenario: Tool result visible to user
- **WHEN** agent finishes executing a tool
- **THEN** agent yields `{"type":"tool_result","name":"<tool_name>","success":true|false,"result":"..."}` which the frontend renders as a visible result card showing the tool's output data

#### Scenario: Failed tool result visible to user
- **WHEN** a tool execution fails (exception, timeout, etc.)
- **THEN** agent yields `{"type":"tool_result","name":"<tool_name>","success":false,"result":"错误信息..."}` visible to the user, and the error is also passed to the LLM as context for recovery

### Requirement: Backward compatibility with text-based tool calls
New function calling mechanism SHALL coexist with the existing system-prompt-based tool call extraction in `route.ts`. Old agents that emit text-based `tool_call` JSON lines MUST continue to work without modification.

#### Scenario: Old agent with text-based tool calls
- **WHEN** `pharma_agent` emits `{"type":"tool_call","name":"canvas.add_node",...}` via the legacy text protocol
- **THEN** `route.ts` intercepts and executes the tool call exactly as before

#### Scenario: New agent with native function calling
- **WHEN** a new `ToolCallableAgent` handles tool execution internally and yields `tool_start`/`tool_result` events
- **THEN** `route.ts` passes these events through to SSE without attempting to re-execute them

### Requirement: Streaming within tool loop iterations
Agent SHALL stream LLM tokens in real-time during each iteration of the tool loop, not buffer until the loop completes.

#### Scenario: Streaming during intermediate LLM call
- **WHEN** LLM is generating a response that may include tool calls within the loop
- **THEN** text tokens are streamed as `AgentChunk` events immediately, and tool calls are detected from the complete response delta
