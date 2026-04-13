## 1. Agent Skeleton and Registration

- [ ] 1.1 Create `agents/investment_advisory_agent/` with `__init__.py`, `agent.py`, and `config.yaml`
- [ ] 1.2 Implement agent class based on existing `BaseAgent` protocol and wire JSON Lines I/O
- [ ] 1.3 Register the new agent in discovery/registry flow so it appears in dashboard agent list

## 2. Multi-Agent Orchestration Core

- [ ] 2.1 Implement planner role to transform user query into executable plan steps
- [ ] 2.2 Implement executor role to execute plan steps through tool and skill calls
- [ ] 2.3 Implement evaluator role to score correctness, coverage, and user-constraint fit (including budget)
- [ ] 2.4 Implement orchestration loop with retry/replan conditions and max-round termination
- [ ] 2.5 Define plan/result/evaluation schemas and validation utilities shared by all roles

## 3. Recommendation Workflow Implementation

- [ ] 3.1 Implement input parsing for goal, horizon, risk preference, budget, and constraints
- [ ] 3.2 Implement deterministic stage pipeline: objective understanding -> risk assessment -> allocation proposal -> action plan -> rationale summary
- [ ] 3.3 Define and return structured output fields (`risk_profile`, `allocation_plan`, `actions`, `assumptions`, `uncertainty_notes`) plus readable summary text
- [ ] 3.4 Ensure chunk streaming and final result output remain protocol-compatible with current SSE chat flow
- [ ] 3.5 Ensure final answer is only emitted after evaluator passes acceptance threshold or loop reaches bounded fallback

## 4. P0 Tooling (Must Have)

- [ ] 4.1 Implement multimodal file-reading tools for text, PDF, and image inputs with normalized output
- [ ] 4.2 Implement search tools (keyword + semantic) with ranked snippets and source citations
- [ ] 4.3 Implement stock trend tool by ticker code with default windows, custom-window validation, and timestamped metadata
- [ ] 4.4 Implement runtime skills loading with version/dependency checks and fallback behavior
- [ ] 4.5 Integrate compliance guardrail tool to block/rewrite prohibited certainty claims before final response

## 5. Safety and Guardrails

- [ ] 5.1 Add mandatory input validation and clarification prompts for missing required advisory context
- [ ] 5.2 Add out-of-scope handling and safe fallback response path
- [ ] 5.3 Enforce non-deterministic language policy to block guarantee/profit-certainty claims
- [ ] 5.4 Attach standardized non-personalized investment disclaimer to both final recommendations and clarification responses

## 6. API and Frontend Integration

- [ ] 6.1 Extend advisory request parameter mapping in backend API/agent invocation layer
- [ ] 6.2 Add/adjust dashboard input controls for advisory fields (risk preference, horizon, budget, constraints)
- [ ] 6.3 Add structured recommendation rendering in chat/workbench UI while preserving text fallback
- [ ] 6.4 Add UI state for planner/executor/evaluator stage progress and evaluator verdict summary
- [ ] 6.5 Verify conversation persistence fields capture advisory responses without schema-breaking changes

## 7. P1 Tooling (Strongly Recommended)

- [ ] 7.1 Implement risk assessment tool that maps user profile to deterministic risk tier and constraints
- [ ] 7.2 Implement portfolio recommendation tool that produces allocation guidance from risk tier and goal
- [ ] 7.3 Connect P1 tools into the main advisory stage pipeline and structured output fields

## 8. P2 Observability (Production Readiness)

- [ ] 8.1 Implement advisory audit log model for input summary, tool call chain, and model/tool versions
- [ ] 8.2 Add trace identifier propagation from API entrypoint to final advisory response
- [ ] 8.3 Add dashboard or query interface for internal audit/replay of advisory sessions

## 9. Validation and Release Readiness

- [ ] 9.1 Add unit tests for planner, executor, evaluator roles and loop termination behavior
- [ ] 9.2 Add integration test for end-to-end advisory request with multi-round loop and final evaluated result
- [ ] 9.3 Add tests for tool contracts: file reading normalization, search citations, ticker trend windows, skill-load fallback
- [ ] 9.4 Add tests/assertions that budget constraints are reflected in final recommendation and evaluator checks
- [ ] 9.5 Add tests/assertions that disclaimer is always present in advisory-context responses
- [ ] 9.6 Run project lint/typecheck/test suite and fix regressions before rollout
- [ ] 9.7 Prepare rollout checklist and fallback toggle to disable the new agent quickly if needed
