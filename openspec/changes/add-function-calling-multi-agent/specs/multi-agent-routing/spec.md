## ADDED Requirements

### Requirement: Supervisor uses Plan-Execute-Check loop for multi-agent collaboration
Supervisor agent SHALL process each user request through a three-phase loop: Plan (generate execution plan), Execute (delegate to sub-agents per plan), Check (evaluate results and decide whether to iterate or finalize).

#### Scenario: Single-domain request with successful check
- **WHEN** user asks "分析恒瑞医药的研发管线"
- **THEN** Supervisor generates a plan with one step (delegate to pharma_analyst), executes it, checks the result is satisfactory, and synthesizes the final response

#### Scenario: Multi-domain request requiring multiple agents
- **WHEN** user asks "恒瑞医药的药物管线和股价走势如何？"
- **THEN** Supervisor generates a plan with two steps (pharma_analyst for pipeline analysis, stock_analyst for price trends), executes both sequentially, checks results cover both domains, and synthesizes a unified response

#### Scenario: Check identifies gaps and triggers re-plan
- **WHEN** Supervisor's check phase determines execution results are incomplete (e.g. stock data was requested but agent failed to provide it)
- **THEN** Supervisor generates a supplementary plan for the missing parts, executes it, and checks again before finalizing

#### Scenario: Maximum PEC iterations reached
- **WHEN** the Plan-Execute-Check loop exceeds the configured maximum iterations (default 3)
- **THEN** Supervisor yields the best available result with a note explaining that some aspects may be incomplete

### Requirement: Plan phase generates structured execution plan visible to user
Supervisor SHALL emit a `plan` event containing the structured execution plan, making the agent's reasoning process transparent to the user.

#### Scenario: Plan event content
- **WHEN** Supervisor completes the planning phase
- **THEN** Supervisor yields `{"type":"plan","steps":[{"agent":"pharma_analyst","task":"..."},{"agent":"stock_analyst","task":"..."}],"reasoning":"..."}` with the full plan visible to the user

#### Scenario: Simple request skips multi-agent plan
- **WHEN** user sends a simple greeting or chitchat (e.g. "你好")
- **THEN** Supervisor responds directly without generating a plan or delegating to sub-agents

### Requirement: Execute phase delegates to sub-agents with real-time output forwarding
During the Execute phase, Supervisor SHALL delegate to sub-agents within the same Python process, forwarding all sub-agent output events to the user in real-time.

#### Scenario: Sub-agent lifecycle within execute phase
- **WHEN** Supervisor executes a plan step by calling `delegate_to_agent`
- **THEN** the sub-agent is instantiated in-process, receives a constructed `AgentRequest`, and all its `AgentChunk`/`AgentToolCall` outputs are forwarded to the user's stream

#### Scenario: Delegation progress events
- **WHEN** Supervisor begins delegating to a sub-agent
- **THEN** Supervisor yields `{"type":"agent_delegate","agent_name":"...","task":"..."}` before execution and `{"type":"agent_result","agent_name":"...","success":true|false,"summary":"..."}` after completion

#### Scenario: Sub-agent execution failure
- **WHEN** a sub-agent raises an exception or yields an `AgentError` during execution
- **THEN** Supervisor captures the error, includes it in the check phase context, and decides whether to retry or skip that step

### Requirement: Check phase evaluates results and decides next action
After executing all plan steps, Supervisor SHALL evaluate the collected results against the original user request, emitting a `check` event with the evaluation visible to the user.

#### Scenario: Check passes — results are satisfactory
- **WHEN** check phase determines all plan steps produced adequate results covering the user's request
- **THEN** Supervisor yields `{"type":"check","passed":true,"summary":"..."}` and proceeds to synthesize the final response

#### Scenario: Check fails — results need supplementation
- **WHEN** check phase determines results are incomplete or contradictory
- **THEN** Supervisor yields `{"type":"check","passed":false,"gaps":["..."],"action":"re-plan"}` and loops back to the Plan phase with gap information

### Requirement: delegate_to_agent as a function calling tool
The `delegate_to_agent` function SHALL be registered in the Supervisor's `ToolRegistry`, invoked by the LLM via native function calling during the Execute phase.

#### Scenario: Delegation tool schema
- **WHEN** Supervisor initializes its tool registry
- **THEN** the registry includes `delegate_to_agent` with parameters `agent_name` (string, required) and `task_description` (string, required)

#### Scenario: Unknown agent name in delegation
- **WHEN** LLM calls `delegate_to_agent` with an unregistered `agent_name`
- **THEN** the tool returns an error message listing available agents, and LLM can retry with a valid name

### Requirement: Sub-agent registry with capability descriptions for planning
Supervisor SHALL maintain a registry of available sub-agents with their names and capability descriptions, included in the planning prompt to inform LLM's plan generation.

#### Scenario: Sub-agent capabilities in plan prompt
- **WHEN** Supervisor constructs its planning prompt
- **THEN** the prompt includes all registered sub-agents with name and capability description (e.g. "pharma_analyst: 医药行业分析、药物管线评估、竞品对比")

### Requirement: Supervisor direct response for simple queries
Supervisor SHALL respond directly without entering the PEC loop when the query is simple enough (greetings, clarifying questions, domain chitchat).

#### Scenario: Simple greeting
- **WHEN** user sends "你好"
- **THEN** Supervisor responds directly with a greeting and capability introduction

#### Scenario: Ambiguous request needing clarification
- **WHEN** user's intent is unclear (e.g. "分析一下")
- **THEN** Supervisor asks a clarifying question directly instead of generating a plan
