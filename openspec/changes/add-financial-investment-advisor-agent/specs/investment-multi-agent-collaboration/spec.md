## ADDED Requirements

### Requirement: System SHALL provide planner role for plan generation
The system SHALL include a planner role that transforms user investment questions into executable plan steps with explicit objectives, required tools, inputs, and success criteria.

#### Scenario: Build plan for stock-worthiness question
- **WHEN** the user asks whether a specific stock is worth investing in
- **THEN** planner generates steps that include financial report analysis, positive and negative news retrieval, stock trend retrieval, and synthesis criteria

#### Scenario: Plan reflects user constraints
- **WHEN** the user includes constraints such as budget and risk preference
- **THEN** planner includes those constraints in plan-level acceptance criteria

### Requirement: System SHALL provide executor role for plan execution
The system SHALL include an executor role that executes planner steps through tool and skill calls and returns structured execution outputs with evidence and citations.

#### Scenario: Executor performs tool sequence
- **WHEN** planner emits a valid execution plan
- **THEN** executor performs tool calls in step order or dependency order and stores intermediate outputs

#### Scenario: Executor returns evidence package
- **WHEN** executor finishes a plan run
- **THEN** executor returns candidate answer plus structured evidence package and source metadata

### Requirement: System SHALL provide evaluator role for quality gate
The system SHALL include an evaluator role that validates candidate answer correctness, evidence completeness, and user-constraint alignment before final output is sent to user.

#### Scenario: Evaluator rejects incomplete coverage
- **WHEN** candidate answer misses required evidence dimensions
- **THEN** evaluator rejects the answer and requests supplemental execution

#### Scenario: Evaluator checks budget fit
- **WHEN** user budget constraint is present
- **THEN** evaluator verifies final recommendation remains within budget constraint and rejects non-compliant output

### Requirement: System SHALL support bounded multi-round collaboration loop
The system SHALL support planner-executor-evaluator iterative rounds with explicit stop conditions, including pass threshold, max rounds, and safe fallback behavior.

#### Scenario: Iteration continues on evaluator rejection
- **WHEN** evaluator marks result below acceptance threshold
- **THEN** system triggers another planning or execution round with gap-focused objectives

#### Scenario: Loop stops at max round with safe fallback
- **WHEN** loop reaches max rounds without pass verdict
- **THEN** system returns bounded fallback response with limitations and recommended next user inputs
