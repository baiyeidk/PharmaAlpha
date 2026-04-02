"""
Canvas HTTP API client for PharmaAlpha agents.

Usage:
    from base.canvas_api import CanvasAPI

    canvas = CanvasAPI(session_id)   # session_id from AgentRequest

    # Add nodes
    node = canvas.add_chart("恒瑞医药 走势", tickers=["600276"])
    node = canvas.add_text("分析摘要", content="Q3营收增长23%...")
    node = canvas.add_image("财报截图")
    node = canvas.add_pdf("年报PDF")

    # Manage nodes
    canvas.update_node(node["id"], content="更新内容")
    canvas.remove_node(node["id"])

    # Query & clear
    data = canvas.list_nodes()    # {"nodes": [...], "edges": [...]}
    canvas.clear()

Environment variables (auto-injected by executor):
    CANVAS_API_BASE  - e.g. http://localhost:3000/api/canvas
    CANVAS_API_KEY   - internal bearer token
"""

from __future__ import annotations

import json
import os
import urllib.request
import urllib.error
from typing import Any


class CanvasAPI:
    """HTTP client for the canvas actions API."""

    def __init__(self, conversation_id: str):
        self.conversation_id = conversation_id
        self.base_url = os.environ.get("CANVAS_API_BASE", "http://localhost:3000/api/canvas")
        self.api_key = os.environ.get("CANVAS_API_KEY", "pharma-agent-internal-key")
        self._url = f"{self.base_url}/{conversation_id}/actions"

    def _request(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self._url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8") if e.fp else ""
            raise RuntimeError(f"Canvas API error {e.code}: {body}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Canvas API connection error: {e.reason}") from e

    # ── Add nodes ────────────────────────────────────────────

    def add_chart(
        self,
        label: str,
        tickers: list[str],
        description: str = "",
    ) -> dict[str, Any]:
        """Add a stock chart node. Returns the created node."""
        payload: dict[str, Any] = {
            "action": "add_node",
            "type": "chart",
            "label": label,
            "tickers": tickers,
        }
        if description:
            payload["description"] = description
        result = self._request(payload)
        return result.get("node", {})

    def add_text(
        self,
        label: str,
        content: str = "",
        description: str = "",
    ) -> dict[str, Any]:
        """Add a text note node. Returns the created node."""
        payload: dict[str, Any] = {
            "action": "add_node",
            "type": "text",
            "label": label,
            "content": content,
        }
        if description:
            payload["description"] = description
        result = self._request(payload)
        return result.get("node", {})

    def add_image(
        self,
        label: str,
        url: str = "",
        description: str = "",
    ) -> dict[str, Any]:
        """Add an image node. Returns the created node."""
        payload: dict[str, Any] = {
            "action": "add_node",
            "type": "image",
            "label": label,
        }
        if url:
            payload["url"] = url
        if description:
            payload["description"] = description
        result = self._request(payload)
        return result.get("node", {})

    def add_pdf(
        self,
        label: str,
        url: str = "",
        description: str = "",
    ) -> dict[str, Any]:
        """Add a PDF node. Returns the created node."""
        payload: dict[str, Any] = {
            "action": "add_node",
            "type": "pdf",
            "label": label,
        }
        if url:
            payload["url"] = url
        if description:
            payload["description"] = description
        result = self._request(payload)
        return result.get("node", {})

    # ── Manage nodes ─────────────────────────────────────────

    def update_node(
        self,
        node_id: str,
        label: str | None = None,
        content: str | None = None,
        tickers: list[str] | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Update an existing node. Returns the updated node."""
        payload: dict[str, Any] = {"action": "update_node", "nodeId": node_id}
        if label is not None:
            payload["label"] = label
        if content is not None:
            payload["content"] = content
        if tickers is not None:
            payload["tickers"] = tickers
        if description is not None:
            payload["description"] = description
        result = self._request(payload)
        return result.get("node", {})

    def remove_node(self, node_id: str) -> bool:
        """Remove a node and its connected edges."""
        result = self._request({"action": "remove_node", "nodeId": node_id})
        return result.get("ok", False)

    # ── Query & clear ────────────────────────────────────────

    def list_nodes(self) -> dict[str, Any]:
        """List all nodes and edges. Returns {"nodes": [...], "edges": [...]}."""
        return self._request({"action": "list_nodes"})

    def clear(self) -> bool:
        """Remove all nodes and edges from the canvas."""
        result = self._request({"action": "clear"})
        return result.get("ok", False)
