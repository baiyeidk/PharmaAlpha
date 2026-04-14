"""Tool registry for function-calling agents."""

from __future__ import annotations

import json
import traceback
from typing import Any, Callable

from .schema import function_to_schema, TOOL_META_ATTR


class ToolNotFoundError(Exception):
    """Raised when executing a tool that is not registered."""
    def __init__(self, name: str, available: list[str]):
        self.name = name
        self.available = available
        super().__init__(
            f"Tool '{name}' not found. Available: {', '.join(available)}"
        )


class ToolRegistry:
    """Registry of callable tools with automatic OpenAI schema generation."""

    def __init__(self) -> None:
        self._tools: dict[str, Callable] = {}
        self._schemas: dict[str, dict[str, Any]] = {}

    def register(self, fn: Callable) -> Callable:
        """Register a function as a tool. Can be used as a decorator."""
        if not hasattr(fn, TOOL_META_ATTR):
            raise ValueError(
                f"Function '{fn.__name__}' must be decorated with @tool() before registering"
            )
        schema = function_to_schema(fn)
        name = fn.__name__
        self._tools[name] = fn
        self._schemas[name] = schema
        return fn

    def get_schemas(self) -> list[dict[str, Any]]:
        """Return OpenAI-compatible tools array."""
        return list(self._schemas.values())

    def get_tool_names(self) -> list[str]:
        return list(self._tools.keys())

    def execute(self, name: str, args: dict[str, Any] | None = None) -> str:
        """Execute a registered tool by name, returning result as string."""
        if name not in self._tools:
            raise ToolNotFoundError(name, self.get_tool_names())
        try:
            result = self._tools[name](**(args or {}))
            if isinstance(result, str):
                return result
            return json.dumps(result, ensure_ascii=False, default=str)
        except ToolNotFoundError:
            raise
        except Exception as e:
            return f"[Tool Error] {name}: {type(e).__name__}: {e}"

    def __len__(self) -> int:
        return len(self._tools)

    def __contains__(self, name: str) -> bool:
        return name in self._tools
