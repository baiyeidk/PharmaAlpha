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
- **RAG**: Custom knowledge base with keyword-based retrieval

## Project Structure

```
src/
├── app/              # Next.js App Router (pages + API routes)
│   ├── (auth)/       # Login / Register pages
│   ├── (dashboard)/  # Main app (Chat, Agents, Settings, RAG)
│   └── api/          # REST + SSE endpoints
│       ├── rag/        # RAG API endpoints
│       └── ...
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

## Features

### RAG (Retrieval-Augmented Generation)

PharmaAlpha includes a built-in RAG system that allows agents to reference custom knowledge bases:

- **Knowledge Base Management**: Upload and manage documents through the web interface
- **Automatic Retrieval**: Agents automatically search relevant knowledge when processing queries
- **Keyword-Based Search**: Fast and accurate retrieval using keyword matching
- **Context Integration**: Retrieved knowledge is seamlessly integrated into agent responses

#### RAG Usage

1. **Access RAG Interface**: Navigate to `/rag` in the dashboard
2. **Upload Documents**: Add documents with title, content, and optional source
3. **Search Knowledge**: Use the search interface to test retrieval
4. **Automatic Integration**: Agents automatically use relevant knowledge when answering questions

#### RAG API

- `GET /api/rag/documents` - List all documents
- `POST /api/rag/documents` - Create a new document
- `GET /api/rag/documents/[id]` - Get document details
- `DELETE /api/rag/documents/[id]` - Delete a document
- `POST /api/rag/search` - Search knowledge base

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

## RAG Configuration

The RAG system is automatically integrated into agent execution. When a user sends a message:

1. The system searches the knowledge base for relevant documents
2. Top matching chunks are retrieved (default: 3)
3. Retrieved context is added to the agent's system message
4. Agent uses this context to generate more informed responses

### RAG Parameters

- `topK`: Number of chunks to retrieve (default: 3)
- `minScore`: Minimum relevance score (default: 0)
- Search algorithm: Keyword-based with scoring

### Database Schema

The RAG system uses two database models:

- `RAGDocument`: Stores document metadata and content
- `RAGChunk`: Stores text chunks for retrieval (future: vector embeddings)
