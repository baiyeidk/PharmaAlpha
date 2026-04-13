## ADDED Requirements

### Requirement: Agent SHALL support multimodal file reading tools
The system SHALL provide file reading tools that can process plain text files, PDF files, and image files, and return normalized content with source references.

#### Scenario: Read and normalize mixed file types
- **WHEN** the user attaches text, PDF, and image files in one advisory session
- **THEN** the agent extracts readable content from each file and produces a unified normalized representation

#### Scenario: Preserve source traceability
- **WHEN** the file reading tool returns extracted content
- **THEN** each extracted section includes source metadata that identifies file name and location hints

### Requirement: Agent SHALL support retrieval and search tools
The system SHALL provide search tools for keyword and semantic retrieval across allowed sources, with relevance ranking and citation snippets.

#### Scenario: Keyword search in advisory context
- **WHEN** the user requests factual lookup for investment context
- **THEN** the search tool returns ranked matches with source snippets

#### Scenario: Semantic search for related evidence
- **WHEN** the user asks concept-level questions without exact keywords
- **THEN** the search tool returns semantically relevant results with confidence signals

### Requirement: Agent SHALL provide stock trend tool by ticker code
The system SHALL provide a stock trend tool that accepts a ticker code and returns recent trend indicators for configurable windows.

#### Scenario: Query recent trend with default windows
- **WHEN** the user asks for recent trend of a ticker code
- **THEN** the tool returns trend indicators for predefined windows and includes timestamped data source metadata

#### Scenario: Query trend with custom window
- **WHEN** the user provides a custom window within allowed bounds
- **THEN** the tool returns trend metrics for that window or a validation error with accepted bounds

### Requirement: Agent SHALL support runtime skills loading
The system SHALL support runtime skill loading with version validation, dependency checks, and fallback behavior when loading fails.

#### Scenario: Successful skill load
- **WHEN** the agent requests loading an existing compatible skill
- **THEN** the skill is activated and recorded in current session context

#### Scenario: Skill load failure fallback
- **WHEN** skill loading fails due to incompatibility or missing dependency
- **THEN** the system reports failure reason and continues with a safe fallback path

#### Scenario: Executor uses skills for frontend presentation
- **WHEN** executor has gathered sufficient evidence for answer rendering
- **THEN** executor invokes configured skills to produce frontend-friendly presentation payloads alongside textual explanation

### Requirement: Agent SHALL include risk assessment and portfolio recommendation tools
The system SHALL include tools that convert user profile and market context into risk tiers and portfolio recommendation suggestions.

#### Scenario: Generate risk tier from profile inputs
- **WHEN** the user provides required profile inputs for advisory assessment
- **THEN** the risk assessment tool returns a deterministic risk tier and constraints summary

#### Scenario: Produce portfolio suggestion from risk tier
- **WHEN** risk tier and objective are available
- **THEN** the portfolio recommendation tool returns allocation guidance with assumptions and uncertainty notes

### Requirement: Agent SHALL enforce compliance guardrail and observability tools
The system SHALL enforce compliance checks on advisory output and SHALL record auditable tool execution metadata.

#### Scenario: Compliance guardrail blocks prohibited claims
- **WHEN** generated advisory text contains prohibited certainty claims
- **THEN** the compliance tool blocks or rewrites the output before final response

#### Scenario: Audit trail is captured for advisory response
- **WHEN** the agent finishes an advisory response
- **THEN** the system stores tool call chain, model/tool versions, and response identifiers for later traceability
