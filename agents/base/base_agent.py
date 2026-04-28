"""
Abstract base class for all PharmaAlpha CLI agents.

Usage:
    class MyAgent(BaseAgent):
        def execute(self, request):
            yield AgentChunk(content="Processing...")
            yield AgentResult(content="Done!")

    if __name__ == "__main__":
        MyAgent().run()
"""

from __future__ import annotations

import json
import sys
import traceback
from abc import ABC, abstractmethod
from typing import Generator, Any, Union

from .protocol import (
    AgentRequest, AgentChunk, AgentToolCall, AgentResult, AgentError, AgentLog,
    AgentToolStart, AgentToolResult, AgentPlan, AgentCheck,
    AgentAgentChunk, AgentDelegate, AgentDelegateResult,
    PhaseStart, PhaseEnd,
)


class BaseAgent(ABC):
    """Base class that handles the CLI JSON Lines protocol."""

    def run(self) -> None:
        """Main entry point: read stdin, execute, write stdout."""
        try:
            self._configure_stdio()
            raw = sys.stdin.readline().strip()
            if not raw:
                self._emit(AgentError(content="Empty input"))
                return

            data = json.loads(raw)
            request = AgentRequest(
                action=data.get("action", "chat"),
                messages=data.get("messages", []),
                session_id=data.get("session_id"),
                params=data.get("params", {}),
            )

            for output in self.execute(request):
                self._emit(output)

        except json.JSONDecodeError as e:
            self._emit(
                AgentError(
                    content=f"Invalid JSON input: {e}",
                    code="INPUT_DECODE_ERROR",
                    details={"exception_type": type(e).__name__},
                )
            )
        except Exception as e:
            tb = traceback.format_exc()
            self._emit(
                AgentError(
                    content=f"Agent execution error: {e}",
                    code="EXECUTION_ERROR",
                    traceback=tb,
                    details={"exception_type": type(e).__name__},
                )
            )
            sys.stderr.write(tb)
            sys.exit(1)

    AgentOutput = Union[
        AgentChunk, AgentToolCall, AgentResult, AgentError, AgentLog,
        AgentToolStart, AgentToolResult, AgentPlan, AgentCheck,
        AgentAgentChunk, AgentDelegate, AgentDelegateResult,
        PhaseStart, PhaseEnd,
    ]

    @abstractmethod
    def execute(
        self, request: AgentRequest
    ) -> Generator[AgentOutput, None, None]:
        """
        Process the request and yield output chunks.
        Must yield at least one AgentResult at the end.
        """
        ...

    def _emit(self, output: Any) -> None:
        """Write a single JSON line to stdout."""
        line = json.dumps(output.to_json(), ensure_ascii=False)
        sys.stdout.write(line + "\n")
        sys.stdout.flush()

    @staticmethod
    def _configure_stdio() -> None:
        """Force UTF-8 stdio on Windows so JSON payloads preserve Chinese text."""
        for stream in (sys.stdin, sys.stdout, sys.stderr):
            reconfigure = getattr(stream, "reconfigure", None)
            if callable(reconfigure):
                reconfigure(encoding="utf-8")
