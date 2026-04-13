## ADDED Requirements

### Requirement: System SHALL provide concise structured context compression
The system SHALL compress multi-round conversation context into a structured summary object for agent-to-agent handoff.

#### Scenario: Compress round output for handoff
- **WHEN** planner, executor, or evaluator completes a round
- **THEN** the system generates a compressed object containing facts, constraints, decisions, open_questions, and evidence_index

#### Scenario: Preserve hard constraints during compression
- **WHEN** source context includes explicit hard constraints
- **THEN** the compressed summary retains those constraints without semantic weakening

#### Scenario: Persist compressed summaries for later reuse
- **WHEN** a round-level compressed summary is generated
- **THEN** the system persists the summary with traceable references for subsequent retrieval

### Requirement: Compression MUST expose confidence and fallback behavior
The compression output MUST include confidence scoring and support fallback when confidence is below threshold.

#### Scenario: Low-confidence compression fallback
- **WHEN** compression confidence is below configured threshold
- **THEN** the system regenerates summary or falls back to expanded context mode

#### Scenario: Compression traceability
- **WHEN** compressed summary references source evidence
- **THEN** each key claim includes an evidence index that can be resolved to source records

### Requirement: Compression strategy SHALL be benchmarked against open-source references
The system SHALL evaluate compression quality and efficiency against selected open-source memory implementations before finalizing default strategy.

#### Scenario: Select default compression policy after benchmark
- **WHEN** benchmark results are collected
- **THEN** the system selects the default compression policy based on fidelity and token-efficiency thresholds
