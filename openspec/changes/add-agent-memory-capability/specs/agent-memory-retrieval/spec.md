## ADDED Requirements

### Requirement: System SHALL retrieve memory with hybrid filtering and ranking
The system SHALL retrieve memory using mandatory filters first and relevance ranking second.

#### Scenario: Apply mandatory filters before ranking
- **WHEN** a retrieval request is executed
- **THEN** the system filters by scope, ownership, type, and TTL before relevance ranking

#### Scenario: Prioritize hard constraints in retrieval
- **WHEN** memory contains hard constraints such as budget or risk preference
- **THEN** the retrieval result prioritizes those constraints for context injection

### Requirement: Retrieval output SHALL be injection-ready
The system SHALL return a normalized retrieval payload that can be injected directly into planner, executor, and evaluator contexts.

#### Scenario: Build context payload for planner
- **WHEN** planner requests memory context
- **THEN** retrieval returns compact normalized fields for facts, constraints, and open questions

#### Scenario: Limit retrieved memory volume
- **WHEN** retrieval result size exceeds configured limits
- **THEN** the system truncates by ranking policy and preserves highest-priority constraints

### Requirement: Memory retrieval SHALL be transparent to users
The system SHALL perform retrieval and injection automatically without requiring explicit memory controls in user-facing interaction flows.

#### Scenario: User sends normal advisory request
- **WHEN** a user submits a standard investment advisory message
- **THEN** the system performs memory retrieval automatically without requiring user memory commands or toggles

### Requirement: Retrieval layer MUST support open-source provider integration
The retrieval layer MUST support provider adapters so that open-source memory engines can be plugged in without changing agent business logic.

#### Scenario: Switch memory provider via adapter
- **WHEN** memory provider configuration changes
- **THEN** retrieval behavior continues through adapter contracts without breaking planner, executor, and evaluator flows
