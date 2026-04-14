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
  {"type": "chunk",          "content": "partial text..."}
  {"type": "tool_call",      "name": "fn", "args": {...}}
  {"type": "tool_start",     "name": "fn", "args": {...}}
  {"type": "tool_result",    "name": "fn", "success": true, "result": "..."}
  {"type": "plan",           "steps": [...], "reasoning": "..."}
  {"type": "check",          "passed": true, "summary": "...", "gaps": [...]}
  {"type": "phase_start",    "phase": "plan|execute|check|synthesize", "round": 1}
  {"type": "phase_end",      "phase": "plan|execute|check|synthesize", "round": 1}
  {"type": "agent_delegate", "agent_name": "...", "task": "..."}
  {"type": "agent_result",   "agent_name": "...", "success": true, "summary": "..."}
  {"type": "result",         "content": "final text...", "metadata": {...}}
  {"type": "error",          "content": "error message", "code": "ERROR_CODE"}
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


# ── Extended protocol events (function calling & multi-agent) ──


@dataclass
class AgentToolStart:
    """Emitted before a tool begins execution (visible to user)."""
    name: str
    args: dict[str, Any] = field(default_factory=dict)
    type: str = "tool_start"

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "name": self.name, "args": self.args}


@dataclass
class AgentToolResult:
    """Emitted after a tool finishes execution (visible to user)."""
    name: str
    result: str = ""
    success: bool = True
    type: str = "tool_result"

    def to_json(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "name": self.name,
            "success": self.success,
            "result": self.result,
        }


@dataclass
class AgentPlan:
    """Emitted when Supervisor generates an execution plan (visible to user)."""
    steps: list[dict[str, Any]] = field(default_factory=list)
    reasoning: str = ""
    type: str = "plan"

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "steps": self.steps, "reasoning": self.reasoning}


@dataclass
class AgentCheck:
    """Emitted when Supervisor evaluates execution results (visible to user)."""
    passed: bool = True
    summary: str = ""
    gaps: list[str] = field(default_factory=list)
    action: str = ""
    type: str = "check"

    def to_json(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "type": self.type,
            "passed": self.passed,
            "summary": self.summary,
        }
        if self.gaps:
            d["gaps"] = self.gaps
        if self.action:
            d["action"] = self.action
        return d


@dataclass
class PhaseStart:
    """Emitted when a PEC phase begins (plan / execute / check / synthesize)."""
    phase: str
    round: int = 1
    type: str = "phase_start"

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "phase": self.phase, "round": self.round}


@dataclass
class PhaseEnd:
    """Emitted when a PEC phase ends."""
    phase: str
    round: int = 1
    type: str = "phase_end"

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "phase": self.phase, "round": self.round}


@dataclass
class AgentAgentChunk:
    """Emitted when forwarding a sub-agent's streaming text (carries agent_name for block routing)."""
    agent_name: str
    content: str = ""
    type: str = "agent_chunk"

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "agent_name": self.agent_name, "content": self.content}


@dataclass
class AgentDelegate:
    """Emitted when Supervisor begins delegating to a sub-agent."""
    agent_name: str
    task: str = ""
    type: str = "agent_delegate"

    def to_json(self) -> dict[str, Any]:
        return {"type": self.type, "agent_name": self.agent_name, "task": self.task}


@dataclass
class AgentDelegateResult:
    """Emitted when a sub-agent finishes execution."""
    agent_name: str
    summary: str = ""
    success: bool = True
    type: str = "agent_result"

    def to_json(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "agent_name": self.agent_name,
            "success": self.success,
            "summary": self.summary,
        }
