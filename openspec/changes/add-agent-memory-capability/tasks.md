## 1. Memory Data Model and Storage

- [ ] 1.1 Define memory entities for session memory and profile memory with lifecycle metadata fields (investment advisory agent scope only)
- [ ] 1.2 Add database schema and migration files for memory records and required indexes
- [ ] 1.3 Implement repository interfaces and concrete storage adapters for memory read/write/update/prune

## 2. Base Memory Service Integration

- [ ] 2.1 Extend agents base protocol with memory service abstraction methods
- [ ] 2.1.1 Add adapter interface for third-party open-source memory providers
- [ ] 2.2 Implement memory write pipeline for extracted facts, constraints, and decisions
- [ ] 2.3 Implement deterministic conflict resolution policy for memory updates (latest-write-wins)
- [ ] 2.4 Add TTL-based prune job or on-read expiry filtering for outdated memory entries

## 3. Memory Retrieval and Injection

- [ ] 3.1 Implement hybrid retrieval pipeline with mandatory filtering and relevance ranking
- [ ] 3.2 Implement hard-constraint prioritization for budget and risk preference entries
- [ ] 3.3 Build normalized injection payload for planner, executor, and evaluator contexts
- [ ] 3.4 Add retrieval limits and truncation policy to prevent context overflow
- [ ] 3.5 Keep memory injection transparent to end users (no explicit UI toggle required)

## 4. Context Compression

- [ ] 4.1 Implement structured context compression output with facts, constraints, decisions, open questions, and evidence index
- [ ] 4.2 Implement constraint-preservation validation to ensure hard constraints are never dropped
- [ ] 4.3 Add compression confidence scoring and low-confidence fallback behavior
- [ ] 4.4 Integrate compression into round handoff flow between planner, executor, and evaluator
- [ ] 4.5 Benchmark compression strategy against selected open-source reference implementations

## 5. Governance and Safety

- [ ] 5.1 Implement policy validation gate for memory write requests (default non-blocking for business fields)
- [ ] 5.2 Implement auditable memory mutation event logging for create, update, and prune actions
- [ ] 5.3 Add per-user memory cleanup and disable switches for operational control
- [ ] 5.4 Keep optional sensitivity-filter hook configurable but disabled by default

## 6. API and Agent Workflow Wiring

- [ ] 6.1 Extend chat and agent invocation flow to include memory retrieval and injection controls
- [ ] 6.2 Wire memory read/write points into planner, executor, and evaluator role execution stages
- [ ] 6.3 Add configuration flags for memory mode, retention policy, and compression thresholds
- [ ] 6.4 Ensure streaming protocol compatibility while attaching memory-related metadata
- [ ] 6.5 Restrict persistent memory workflow to investment advisory agent paths only

## 7. Open-Source Memory Integration

- [ ] 7.1 Integrate Mem0 as primary memory provider through adapter interface
- [ ] 7.2 Validate LangMem-inspired hot-path/background patterns for retrieval and consolidation
- [ ] 7.3 Add provider selection config and fallback path for future replacement

## 8. Validation and Rollout

- [ ] 8.1 Add unit tests for memory model, conflict resolution (latest-write-wins), retrieval ranking, and compression fidelity
- [ ] 8.2 Add integration tests for end-to-end multi-round conversation with memory persistence and recall
- [ ] 8.3 Add tests for transparent memory behavior (no explicit user control UI)
- [ ] 8.4 Add performance tests for retrieval latency and compression token reduction
- [ ] 8.5 Run lint, typecheck, and test suites and resolve regressions
- [ ] 8.6 Prepare rollout plan with feature flag and rollback steps
