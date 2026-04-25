<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Context

PharmaAlpha is a pharmaceutical investment decision platform, not a pure frontend mockup. The repository already contains real backend foundations for chat, canvas, RAG, agent execution, authentication, PostgreSQL persistence, employee profiles, skills, SOPs, workflows, projects, and artifacts.

The product direction is `project-first`:

- `InvestmentProject` is the top-level collaboration container.
- A project owns one main `Conversation` and reuses that conversation's canvas.
- Project members collaborate directly in the project.
- Skills and SOPs are reusable employee capabilities.
- `WorkflowDraft` is treated as a project skill session runtime draft, not as the top-level product object.
- `WorkflowExecution` is a concrete session run.
- `ProjectArtifact` is durable project output and reusable input.

## Current Product Reality

There are now two employee-investment surfaces:

- `src/app/(dashboard)/investment-team/projects/page.tsx` is the current project-first workspace and should be preferred for new work.
- `src/app/(dashboard)/investment-team/page.tsx` is the legacy workflow-first page and should be treated as transitional.

The project-first workspace is backend-backed. It can create/list projects, show members, reuse shared chat/canvas, persist artifacts, edit/delete artifacts, create project skill sessions, execute sessions, and write outputs back as artifacts.

Recent project-first behavior:

- Team tasks are created from project members, their `SkillDefinition`, and their `SkillSop`.
- The project task form avoids frontend over-blocking. If topic/SOP is omitted, it falls back to a valid task topic and the member skill's default/first SOP.
- Completed tasks are historical records. They should not stay in the runnable task slot; use view output or duplicate into a new draft.
- Session execution first calls an OpenAI-compatible LLM endpoint directly with project context, skill description, SOP description, structured SOP config, and selected input artifacts.
- If direct LLM execution fails, the route falls back to the Python employee investment agent and finally to a diagnostic artifact fallback.
- Demo SOPs in `prisma/seeds/project_first_demo.sql` should be realistic business SOPs, not placeholder labels. Examples include financial statement/valuation analysis, cashflow resilience, reimbursement policy risk, and clinical readout differentiation.

The system still uses demo-oriented data in some areas:

- Demo employees are loaded from the database, filtered by `employeeCode` starting with `demo-`.
- Risk simulation and notification loops are not yet full end-to-end backend products.
- Some old workflow-first UI language still exists in the legacy page.

Do not add new core business behavior as static React arrays. If demo data is needed for the project-first UI, add it through SQL seeds or API-backed records.

## Access Policy

During the competition/demo phase, project access is open by default for authenticated users.

- Default behavior: authenticated users can view project-first demo projects.
- Strict behavior: set `EMPLOYEE_PROJECT_ACCESS_OPEN=false` to require active `InvestmentProjectMember` membership.

`InvestmentProjectMember` is still important. It records owner/member semantics, supports member display, contributes to project context, and is the basis for future strict authorization.

## Architecture Overview

### Frontend

- `src/app/(dashboard)/investment-team/projects/page.tsx`: project-first workspace.
- `src/hooks/use-employee-investment-projects.ts`: project-first data access hook.
- `src/components/chat/chat-view.tsx`: shared chat/canvas shell, now accepts optional `projectId` so project chat can save artifacts.
- `src/components/canvas/*`: shared canvas, now can save nodes as project artifacts when a project context is active.
- `src/app/(dashboard)/investment-team/page.tsx`: legacy workflow-first page.
- `src/hooks/use-employee-investment-workbench.ts`: legacy workflow-first hook.

### Backend

- `src/app/api/employee-investment/projects/*`: project CRUD, members, artifacts, and sessions.
- `src/app/api/employee-investment/sessions/*`: session detail and execution.
- `src/app/api/chat/*`: chat history, streaming, persistence, and project context injection.
- `src/app/api/canvas/*`: board persistence with project conversation access checks.
- `src/lib/employee-investment/projects.ts`: project access and project conversation helpers.
- `src/lib/employee-investment/serializers.ts`: API response serializers.
- `src/lib/employee-investment/agent.ts`: bridge to the Python employee investment agent.

### Persistence

Key Prisma models:

- `Conversation`, `Message`, `CanvasNode`, `CanvasEdge`
- `Document`, `DocumentChunk`, `ConversationSummary`
- `EmployeeProfile`, `SkillDefinition`, `SkillSop`, `SkillScript`
- `InvestmentProject`, `InvestmentProjectMember`
- `WorkflowDraft`, `WorkflowNode`, `WorkflowExecution`
- `ProjectArtifact`

Reuse these models where possible. Do not introduce parallel project, board, or artifact tables without a clear reason.

## Implementation Guidance

When changing this repository:

1. Preserve and extend real backend paths that already exist.
2. Prefer project-first APIs and UI for new employee-investment work.
3. Avoid deepening the legacy workflow-first page unless specifically maintaining compatibility.
4. Reuse existing conversation and canvas infrastructure before creating new collaboration primitives.
5. Treat workflow output as durable `ProjectArtifact`, not as ephemeral panel-only text.
6. Keep project access open by default for demo unless the user explicitly asks for strict authorization.
7. For demo data visible in the project-first UI, prefer SQL seed files under `prisma/seeds/`.
8. When adding Next.js code, verify current framework guidance from `node_modules/next/dist/docs/` first.

## Demo Seed

Use `prisma/seeds/project_first_demo.sql` after migrations to populate project-first demo data.

It creates or updates:

- `employee_investment_team` and `supervisor_agent` agent rows.
- demo users and employee profiles.
- demo skills and SOPs.
- project-first demo projects.
- project main conversations and canvas nodes.
- project artifacts.
- project skill sessions and one completed execution.

The project-first frontend reads these records through APIs. Do not duplicate the same data as static frontend arrays.

## Runtime Configuration

Do not commit `.env` or other local secret files. `.gitignore` excludes `.env*`; keep only non-secret examples in `.env.example`.

Required/important local configuration:

- `DATABASE_URL`: PostgreSQL connection string.
- `DEEPSEEK_API_KEY` or `LLM_API_KEY`: required for real skill/SOP execution.
- `LLM_BASE_URL`: optional OpenAI-compatible endpoint, defaults to `https://api.deepseek.com` in project skill execution.
- `LLM_MODEL`: optional chat model, defaults to `deepseek-chat`.
- `EMPLOYEE_PROJECT_ACCESS_OPEN`: defaults to open demo access unless set to `false`.

Python agent dependencies are listed in `agents/requirements.txt`. The project-first LLM path depends on the OpenAI-compatible API from Next.js and the Python fallback depends on `openai` and `psycopg`.

## Known Gaps

The following areas are still incomplete or transitional:

- Invitation acceptance/removal workflow for project members.
- Artifact versioning and full lineage visualization.
- End-to-end risk radar and scenario simulation backend logic.
- Notification delivery and feedback writeback loop.
- More detailed session execution status UI, including retry and failure reasons.

## Documentation Expectations

If you change the product model or implementation direction:

- Update the relevant plan/status document under `docs/plans/`.
- Keep `AGENTS.md` aligned with the latest architectural intent.
- Make temporary frontend-only behavior explicit, including what backend capability is still missing.
