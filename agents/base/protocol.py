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

    # ── Canvas convenience constructors ──────────────────────

    @staticmethod
    def canvas_add_chart(
        label: str,
        tickers: list[str],
        description: str = "",
    ) -> "AgentToolCall":
        """Add a stock chart node to the canvas."""
        args: dict[str, Any] = {"type": "chart", "label": label, "tickers": tickers}
        if description:
            args["description"] = description
        return AgentToolCall(name="canvas.add_node", args=args)

    @staticmethod
    def canvas_add_text(
        label: str,
        content: str,
        description: str = "",
    ) -> "AgentToolCall":
        """Add a text note node to the canvas."""
        args: dict[str, Any] = {"type": "text", "label": label, "content": content}
        if description:
            args["description"] = description
        return AgentToolCall(name="canvas.add_node", args=args)

    @staticmethod
    def canvas_add_image(
        label: str,
        url: str = "",
        description: str = "",
    ) -> "AgentToolCall":
        """Add an image node to the canvas."""
        args: dict[str, Any] = {"type": "image", "label": label}
        if url:
            args["url"] = url
        if description:
            args["description"] = description
        return AgentToolCall(name="canvas.add_node", args=args)

    @staticmethod
    def canvas_add_pdf(
        label: str,
        url: str = "",
        description: str = "",
    ) -> "AgentToolCall":
        """Add a PDF node to the canvas."""
        args: dict[str, Any] = {"type": "pdf", "label": label}
        if url:
            args["url"] = url
        if description:
            args["description"] = description
        return AgentToolCall(name="canvas.add_node", args=args)

    @staticmethod
    def canvas_remove_node(node_id: str) -> "AgentToolCall":
        """Remove a node from the canvas."""
        return AgentToolCall(name="canvas.remove_node", args={"nodeId": node_id})

    @staticmethod
    def canvas_update_node(
        node_id: str,
        label: str | None = None,
        content: str | None = None,
        tickers: list[str] | None = None,
        description: str | None = None,
    ) -> "AgentToolCall":
        """Update an existing canvas node."""
        args: dict[str, Any] = {"nodeId": node_id}
        if label is not None:
            args["label"] = label
        if content is not None:
            args["content"] = content
        if tickers is not None:
            args["tickers"] = tickers
        if description is not None:
            args["description"] = description
        return AgentToolCall(name="canvas.update_node", args=args)


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
