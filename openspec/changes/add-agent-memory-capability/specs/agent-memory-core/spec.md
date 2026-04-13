## ADDED Requirements

### Requirement: System SHALL support dual-layer memory model
The system SHALL implement two memory layers: session memory for temporary conversation state and profile memory for long-term user preferences and constraints.

#### Scenario: Memory scope is limited to investment advisory agent
- **WHEN** an agent outside investment advisory flow requests persistent memory operations
- **THEN** the system rejects persistent memory write/read for that request and uses in-loop transient context only

#### Scenario: Write temporary facts to session memory
- **WHEN** planner or executor extracts round-specific facts during an active conversation
- **THEN** the system writes those facts to session memory scoped to the current conversation

#### Scenario: Persist stable preferences to profile memory
- **WHEN** evaluator confirms stable user preference or long-term constraint
- **THEN** the system writes that information to profile memory scoped to the user identity

### Requirement: Memory entries MUST support lifecycle metadata
Each memory entry MUST include metadata fields for source reference, confidence, update timestamp, and expiration policy.

#### Scenario: Create memory entry with metadata
- **WHEN** the system persists a new memory entry
- **THEN** the entry includes source_ref, confidence, updated_at, and ttl fields

#### Scenario: Expire outdated memory entries
- **WHEN** memory entries reach configured TTL
- **THEN** those entries are excluded from retrieval and marked for cleanup
