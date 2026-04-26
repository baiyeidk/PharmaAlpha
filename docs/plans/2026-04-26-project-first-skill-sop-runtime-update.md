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

## Skill/SOP Maintenance Direction

Skill and SOP maintenance should be employee-owned, not project-owned.

Current implementation:

- `/investment-team/skills` is the dedicated page for the logged-in employee's own capabilities.
- Users can create only their own `SkillDefinition`.
- Users can add SOPs only to skills they own.
- Project pages consume member skills for task assignment but should not create or edit another member's capabilities.
- `/api/employee-investment/skills` no longer accepts a target employee id from the client. It resolves the employee from the authenticated session.
- `/api/employee-investment/skills/:skillId/sops` verifies ownership before writing SOP records.

This keeps the product model clear: projects assign work to existing employee capabilities; employees maintain their own capability library.

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

## Docker Deployment

The Docker image contains the Next.js app, Prisma client, Python agent runtime dependencies, `postgresql-client`, and the runtime entrypoint script.

The Docker startup path handles database bootstrap for the demo environment:

1. Wait for `DATABASE_URL` to become reachable.
2. Enable the `vector` extension.
3. Run `npx prisma db push --accept-data-loss`.
4. Run `prisma/seeds/project_first_demo.sql` when `RUN_PROJECT_FIRST_SEED=true`.
5. Start the Next.js server.

For production or externally managed databases, set `RUN_PROJECT_FIRST_SEED=false` and run migrations/seeds through the deployment pipeline instead of app startup.

`docker-compose.yml` starts a local `pgvector/pgvector:pg16` database by default. If `.env.production` is absent, compose still starts and uses the non-secret defaults from the compose file plus environment variables provided by the shell.

## Verification

Verified locally:

- `npx tsc --noEmit`
- targeted eslint for project-first page, project hook, and session execution API
- local Python imports for `openai` and `psycopg`
