"""Generate OpenAI function-calling schemas from Python type annotations."""

from __future__ import annotations

import inspect
import re
from typing import Any, Callable, get_type_hints, get_origin, get_args

_PY_TO_JSON: dict[type, str] = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
}

TOOL_META_ATTR = "__tool_meta__"


def tool(description: str) -> Callable:
    """Decorator that attaches tool metadata to a function."""
    def decorator(fn: Callable) -> Callable:
        setattr(fn, TOOL_META_ATTR, {"description": description})
        return fn
    return decorator


def _parse_docstring_params(docstring: str | None) -> dict[str, str]:
    """Extract ``param_name: description`` pairs from a docstring."""
    if not docstring:
        return {}
    result: dict[str, str] = {}
    for line in docstring.strip().splitlines():
        line = line.strip()
        m = re.match(r"^(\w+)\s*:\s*(.+)$", line)
        if m:
            result[m.group(1)] = m.group(2).strip()
    return result


def _python_type_to_json(tp: type) -> dict[str, Any]:
    origin = get_origin(tp)
    if origin is list:
        args = get_args(tp)
        item_type = args[0] if args else str
        return {"type": "array", "items": _python_type_to_json(item_type)}
    if tp in _PY_TO_JSON:
        return {"type": _PY_TO_JSON[tp]}
    return {"type": "string"}


def function_to_schema(fn: Callable) -> dict[str, Any]:
    """Build an OpenAI ``tools`` entry from a decorated function."""
    meta = getattr(fn, TOOL_META_ATTR, {})
    description = meta.get("description", fn.__name__)

    hints = get_type_hints(fn)
    sig = inspect.signature(fn)
    doc_params = _parse_docstring_params(fn.__doc__)

    properties: dict[str, Any] = {}
    required: list[str] = []

    for name, param in sig.parameters.items():
        if name in ("self", "cls"):
            continue
        tp = hints.get(name, str)
        prop = _python_type_to_json(tp)
        if name in doc_params:
            prop["description"] = doc_params[name]
        properties[name] = prop
        if param.default is inspect.Parameter.empty:
            required.append(name)

    return {
        "type": "function",
        "function": {
            "name": fn.__name__,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }
