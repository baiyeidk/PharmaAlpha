"""Canvas tools — add/update/remove nodes on the analysis canvas.

These tools work by returning a confirmation string for the LLM and
simultaneously emitting AgentToolCall protocol events (via a callback set
by ToolCallableAgent) so the server-side TransformStream can execute them.
"""

from __future__ import annotations

from typing import Any, Callable

from base.tools.schema import tool

_emit_cb: Callable | None = None
_added_chart_tickers: set[frozenset[str]] = set()
_added_text_labels: set[str] = set()


def set_emit_callback(cb: Callable) -> None:
    """Set by ToolCallableAgent so canvas tools can emit protocol events."""
    global _emit_cb
    _emit_cb = cb


def init_dedup_from_canvas(nodes: list[dict[str, Any]]) -> None:
    """Pre-populate dedup sets from existing canvas nodes loaded from DB."""
    _added_chart_tickers.clear()
    _added_text_labels.clear()
    for n in nodes:
        node_type = n.get("type", "")
        tickers = n.get("tickers")
        label = n.get("label", "")
        if node_type == "chart" and tickers and isinstance(tickers, list):
            _added_chart_tickers.add(frozenset(tickers))
        elif node_type == "text" and label:
            _added_text_labels.add(label)


def _emit_tool_call(name: str, args: dict[str, Any]) -> None:
    if _emit_cb:
        from base.protocol import AgentToolCall
        _emit_cb(AgentToolCall(name=name, args=args))


@tool(description="在画布上添加股票走势图节点")
def canvas_add_chart(label: str, tickers: list[str], description: str = "") -> str:
    """label: 节点标题; tickers: A股代码列表如['600276']; description: 可选描述"""
    key = frozenset(tickers)
    if key in _added_chart_tickers:
        return f"走势图已存在，跳过: {', '.join(tickers)}"
    args: dict[str, Any] = {"type": "chart", "label": label, "tickers": tickers}
    if description:
        args["description"] = description
    _emit_tool_call("canvas.add_node", args)
    _added_chart_tickers.add(key)
    return f"已添加走势图: {label} (股票: {', '.join(tickers)})"


@tool(description="在画布上添加文本笔记节点")
def canvas_add_text(label: str, content: str, description: str = "") -> str:
    """label: 节点标题; content: 文本内容(支持markdown); description: 可选描述"""
    if label in _added_text_labels:
        return f"文本节点已存在，跳过: {label}"
    args: dict[str, Any] = {"type": "text", "label": label, "content": content}
    if description:
        args["description"] = description
    _emit_tool_call("canvas.add_node", args)
    _added_text_labels.add(label)
    return f"已添加文本节点: {label}"


@tool(description="在画布上添加图片节点")
def canvas_add_image(label: str, url: str = "", description: str = "") -> str:
    """label: 节点标题; url: 图片URL; description: 可选描述"""
    args: dict[str, Any] = {"type": "image", "label": label}
    if url:
        args["url"] = url
    if description:
        args["description"] = description
    _emit_tool_call("canvas.add_node", args)
    return f"已添加图片节点: {label}"


@tool(description="从画布上移除指定节点")
def canvas_remove_node(node_id: str) -> str:
    """node_id: 要移除的节点ID"""
    _emit_tool_call("canvas.remove_node", {"nodeId": node_id})
    return f"已移除节点: {node_id}"


@tool(description="更新画布上已有节点的内容")
def canvas_update_node(
    node_id: str,
    label: str = "",
    content: str = "",
    description: str = "",
) -> str:
    """node_id: 目标节点ID; label: 新标题; content: 新内容; description: 新描述"""
    args: dict[str, Any] = {"nodeId": node_id}
    if label:
        args["label"] = label
    if content:
        args["content"] = content
    if description:
        args["description"] = description
    _emit_tool_call("canvas.update_node", args)
    return f"已更新节点: {node_id}"
