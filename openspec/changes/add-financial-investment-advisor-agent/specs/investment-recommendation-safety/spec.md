## ADDED Requirements

### Requirement: System SHALL enforce recommendation safety guardrails
The system SHALL enforce safety guardrails before and during recommendation generation, including capability boundary checks and prohibited certainty claims.

#### Scenario: Out-of-scope investment request
- **WHEN** user asks for actions outside supported advisory scope
- **THEN** the system declines unsupported operations and provides a safe alternative guidance path

#### Scenario: Certainty claim prevention
- **WHEN** the generated recommendation contains deterministic profit or guarantee language
- **THEN** the system rewrites or blocks the output to remove prohibited certainty claims

### Requirement: System MUST collect required context before issuing recommendation
The system MUST request clarifying information when mandatory advisory inputs are missing, and MUST NOT produce full recommendations until required context is available.

#### Scenario: Missing risk preference
- **WHEN** user requests investment advice without risk preference
- **THEN** the system asks a clarifying question and postpones final recommendation output

#### Scenario: Missing investment horizon and budget
- **WHEN** both investment horizon and budget are absent
- **THEN** the system requests those values and returns only provisional guidance with explicit limitations

### Requirement: Recommendation response SHALL include non-personalized disclaimer
Every investment recommendation response SHALL include a visible disclaimer that the output is informational and not guaranteed personalized fiduciary advice.

#### Scenario: Standard advisory response disclaimer
- **WHEN** the system returns a final recommendation
- **THEN** the response includes the standard non-personalized disclaimer section

#### Scenario: Clarification response disclaimer
- **WHEN** the system returns a clarification request in advisory context
- **THEN** the response still includes a concise advisory-risk disclaimer
