## ADDED Requirements

### Requirement: Investment advisory agent SHALL produce structured recommendations
The system SHALL provide an investment advisory agent that accepts user investment intent and returns structured recommendation content including risk profile, allocation plan, action checklist, and assumptions.

#### Scenario: Generate recommendation with complete user profile
- **WHEN** user provides investment goal, investment horizon, risk preference, budget, and constraints
- **THEN** the agent returns a recommendation containing all required structured sections

#### Scenario: Include explainability fields in output
- **WHEN** the agent returns a recommendation
- **THEN** the response includes key assumptions and uncertainty notes for major recommendations

#### Scenario: Respect explicit budget constraints
- **WHEN** the user provides an explicit budget amount (for example, 500000)
- **THEN** the final recommendation includes allocation and action suggestions that are consistent with that budget constraint

### Requirement: Investment advisory workflow SHALL follow deterministic stage order
The system MUST execute recommendation generation in the following order: objective understanding, risk assessment, allocation proposal, action plan, and summary rationale.

#### Scenario: Normal recommendation flow
- **WHEN** a valid recommendation request is processed
- **THEN** the generated output reflects all workflow stages in the defined order

#### Scenario: Partial information flow with fallback
- **WHEN** a request is valid but contains limited optional context
- **THEN** the system still completes all workflow stages and marks assumptions explicitly

### Requirement: Investment advisory output SHALL include multi-source evidence coverage
The system SHALL ground the recommendation using at least these evidence dimensions when applicable: company financial report signals, positive and negative news signals, and stock trend signals.

#### Scenario: Equity investment question requires broad evidence
- **WHEN** the user asks whether a specific stock is worth investing in
- **THEN** the recommendation references financial report evidence, both positive and negative news evidence, and stock trend evidence

#### Scenario: Missing evidence source triggers limitations note
- **WHEN** one required evidence dimension is temporarily unavailable
- **THEN** the system explicitly states the missing source and reduces confidence in the recommendation

### Requirement: Agent response SHALL be compatible with existing streaming protocol
The system MUST emit recommendation responses through the existing JSON Lines + SSE streaming protocol without breaking current chat rendering behavior.

#### Scenario: Streaming chunk and final result compatibility
- **WHEN** the advisory agent is invoked from the dashboard chat channel
- **THEN** the system streams chunks and emits a final result using existing protocol contracts
