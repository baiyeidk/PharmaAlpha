# PharmaAlpha

AI-powered Agent platform for pharmaceutical intelligence, built with Next.js 16 full-stack architecture.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components, Turbopack)
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Auth**: NextAuth.js v5 (Auth.js)
- **Database**: PostgreSQL + Prisma v7 (Driver Adapter)
- **State**: Zustand
- **Agent Runtime**: Python 3.11+, CLI JSON Lines protocol
- **Streaming**: Server-Sent Events (SSE)

## Project Structure

```
src/
├── app/              # Next.js App Router (pages + API routes)
│   ├── (auth)/       # Login / Register pages
│   ├── (dashboard)/  # Main app (Chat, Agents, Settings)
│   └── api/          # REST + SSE endpoints
├── components/       # React components (ui, chat, layout)
├── hooks/            # Custom React hooks
├── lib/              # Core libraries
│   ├── agents/       # Agent executor, registry, stream utils
│   ├── auth.ts       # NextAuth config
│   └── db.ts         # Prisma client singleton
└── types/            # TypeScript types

agents/               # Python Agent implementations
├── base/             # Base agent class + protocol
└── pharma_agent/     # Demo agent
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Python 3.11+
- PostgreSQL

### Setup

```bash
# Install Node dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL connection string

# Generate Prisma client
pnpm exec prisma generate

# Run database migrations
pnpm exec prisma migrate dev --name init

# Install Python agent dependencies
pip install -r agents/requirements.txt

# Start dev server
pnpm dev
```

## Adding a New Agent

1. Create a directory under `agents/`:

```
agents/my_agent/
├── __init__.py
├── agent.py       # Entry point
└── config.yaml    # Agent metadata
```

2. Implement `BaseAgent`:

```python
from base import BaseAgent
from base.protocol import AgentRequest, AgentChunk, AgentResult

class MyAgent(BaseAgent):
    def execute(self, request):
        yield AgentChunk(content="Processing...")
        yield AgentResult(content="Done!")

if __name__ == "__main__":
    MyAgent().run()
```

3. Add `config.yaml`:

```yaml
name: my_agent
display_name: My Agent
description: Description of what this agent does
entry_point: my_agent/agent.py
```

4. The agent will be auto-discovered by the Registry.

## CLI Protocol

Agents communicate via stdin/stdout JSON Lines:

**Input** (stdin):
```json
{"action": "chat", "messages": [{"role": "user", "content": "..."}], "params": {}}
```

**Output** (stdout, one JSON per line):
```json
{"type": "chunk", "content": "partial text..."}
{"type": "result", "content": "final text...", "metadata": {}}
```

## Spec 驱动开发

使用仓库内模板，以 Spec 优先的方式推进功能开发：

- `docs/spec-driven/INVESTMENT_AGENT_SPEC_TEMPLATE.md`：功能规格模板
- `docs/spec-driven/COPILOT_SPEC_PROMPTS.md`：可复用 Copilot 提示词
- `docs/spec-driven/SPEC_WORKFLOW_CHECKLIST.md`：执行与发布检查清单

推荐流程：

1. 先编写 Spec
2. 根据 Spec 设计测试
3. 以最小实现满足验收标准
4. 执行 Spec 覆盖审计与安全闸门审查
