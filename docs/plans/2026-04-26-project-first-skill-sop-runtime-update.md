# Project-first Skill/SOP Runtime Update

Updated: 2026-04-26

## Summary

The project-first workspace now treats skill execution as a real project team task flow instead of a static frontend demo.

Key behavior:

1. `Team Tasks` creates a new project task/session for each employee + skill + SOP combination.
2. Completed tasks move to `Completed Work` and are treated as historical records.
3. Completed tasks can be viewed or duplicated into a new draft, but should not be re-run in place.
4. `Create & Run` avoids frontend over-blocking. Missing task topic falls back to `${skill.name} analysis`; missing SOP falls back to the default/first SOP; invalid current selection falls back to the first available project member skill.
5. Session execution creates a `WorkflowExecution` and writes the result into a durable `ProjectArtifact`.

## Real SOP Content

The demo seed now uses business-realistic SOPs instead of placeholder labels.

Included examples:

- `创新药财报与估值分析 SOP（标准版）`
- `创新药现金流韧性分析 SOP`
- `医保政策与支付风险分析 SOP`
- `临床读出与竞品差异化分析 SOP`

Each SOP includes structured config such as:

- role framing
- workflow steps
- required output sections
- quality bar
- missing-data handling rules

The goal is for model output to look like a real investment research memo, not a demo fallback.

## Execution Path

`POST /api/employee-investment/sessions/:sessionId/execute` now builds a prompt from:

- project title and topic
- task topic
- selected skill name and description
- selected SOP name and description
- structured SOP config JSON
- selected input project artifacts

Execution order:

1. Direct OpenAI-compatible LLM call from the Next.js route.
2. Python `employee_investment_team` agent fallback.
3. Diagnostic markdown artifact fallback if both model paths fail.

This ensures the normal path actually uses the detailed SOP prompt.

## Configuration

Local secrets must stay in `.env` and must not be committed.

Relevant variables:

- `DATABASE_URL`: PostgreSQL connection.
- `DEEPSEEK_API_KEY` or `LLM_API_KEY`: required for real model execution.
- `LLM_BASE_URL`: optional OpenAI-compatible endpoint, defaults to `https://api.deepseek.com`.
- `LLM_MODEL`: optional chat model, defaults to `deepseek-chat`.
- `EMPLOYEE_PROJECT_ACCESS_OPEN`: demo access is open unless this is set to `false`.

`.env.example` contains non-secret placeholders for these values.

Python fallback dependencies are tracked in `agents/requirements.txt`, including:

- `openai>=1.0.0`
- `psycopg[binary]>=3.2.0`

## Verification

Verified locally:

- `npx tsc --noEmit`
- targeted eslint for project-first page, project hook, and session execution API
- local Python imports for `openai` and `psycopg`

