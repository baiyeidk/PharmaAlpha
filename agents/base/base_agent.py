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
from typing import Generator, Any

from .protocol import AgentRequest, AgentChunk, AgentResult, AgentError


class BaseAgent(ABC):
    """Base class that handles the CLI JSON Lines protocol."""

    def run(self) -> None:
        """Main entry point: read stdin, execute, write stdout."""
        try:
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
            self._emit(AgentError(content=f"Invalid JSON input: {e}"))
        except Exception as e:
            self._emit(
                AgentError(
                    content=f"Agent execution error: {e}",
                    code="EXECUTION_ERROR",
                )
            )
            sys.stderr.write(traceback.format_exc())

    @abstractmethod
    def execute(
        self, request: AgentRequest
    ) -> Generator[AgentChunk | AgentResult | AgentError, None, None]:
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
