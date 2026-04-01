"""
CLI JSON Lines Protocol for PharmaAlpha Agents.

INPUT  (stdin, single JSON line):
  {
    "action": "chat",
    "session_id": "...",
    "messages": [{"role": "user", "content": "..."}],
    "params": {}
  }

OUTPUT (stdout, one JSON object per line):
  {"type": "chunk",     "content": "partial text..."}
  {"type": "tool_call", "name": "fn", "args": {...}}
  {"type": "result",    "content": "final text...", "metadata": {...}}
  {"type": "error",     "content": "error message", "code": "ERROR_CODE"}
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class AgentMessage:
    role: str
    content: str
    metadata: dict[str, Any] | None = None


@dataclass
class AgentRequest:
    action: str
    messages: list[dict[str, Any]]
    session_id: str | None = None
    params: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentChunk:
    content: str
    type: str = "chunk"

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "content": self.content}


@dataclass
class AgentToolCall:
    name: str
    args: dict[str, Any] = field(default_factory=dict)
    type: str = "tool_call"

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "name": self.name, "args": self.args}


@dataclass
class AgentResult:
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    type: str = "result"

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "content": self.content, "metadata": self.metadata}


@dataclass
class AgentError:
    content: str
    code: str = "AGENT_ERROR"
    type: str = "error"

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "content": self.content, "code": self.code}
