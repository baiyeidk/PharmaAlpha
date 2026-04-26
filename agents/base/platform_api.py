"""Unified HTTP client for Python agents to call Next.js platform API endpoints."""

from __future__ import annotations

import json
import os
import urllib.request
import urllib.error
import urllib.parse
from typing import Any


class PlatformAPIClient:
    """HTTP client for calling Next.js API routes from Python agents."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = 15.0,
    ) -> None:
        self.base_url = (
            base_url
            or os.environ.get("PLATFORM_API_BASE")
            or "http://localhost:3000/api"
        ).rstrip("/")
        self.api_key = (
            api_key
            or os.environ.get("AGENT_API_KEY")
            or "pharma-agent-internal-key"
        )
        self.user_id = os.environ.get("AGENT_USER_ID") or os.environ.get("MEMORY_USER_ID")
        self.timeout = timeout

    def _build_url(self, path: str, params: dict[str, str] | None = None) -> str:
        """Build a safe URL for non-ASCII paths (e.g. Chinese filenames)."""
        parsed = urllib.parse.urlsplit(path)
        raw_path = parsed.path if parsed.scheme else path
        # Keep URL separators unescaped while encoding non-ASCII path segments.
        encoded_path = urllib.parse.quote(raw_path, safe="/-_.~")

        if parsed.scheme:
            base = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, encoded_path, parsed.query, parsed.fragment))
        else:
            base = f"{self.base_url}{encoded_path}"

        query_params: dict[str, str] = {}
        if parsed.query:
            query_params.update(dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)))
        if params:
            query_params.update(params)

        if query_params:
            return f"{base}?{urllib.parse.urlencode(query_params)}"
        return base

    def get(
        self, path: str, params: dict[str, str] | None = None
    ) -> Any:
        url = self._build_url(path, params)
        return self._request(url, method="GET")

    def get_bytes(
        self, path: str, params: dict[str, str] | None = None
    ) -> bytes:
        """GET that returns raw bytes (for file downloads)."""
        url = self._build_url(path, params)
        return self._request_raw(url)

    def post(self, path: str, body: dict[str, Any] | None = None) -> Any:
        url = self._build_url(path)
        return self._request(url, method="POST", body=body)

    def _request(
        self, url: str, method: str = "GET", body: dict[str, Any] | None = None
    ) -> Any:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        if self.user_id:
            headers["X-Agent-User-Id"] = self.user_id
        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            resp_body = e.read().decode("utf-8") if e.fp else ""
            raise RuntimeError(f"Platform API error {e.code} {url}: {resp_body}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Platform API connection error {url}: {e.reason}") from e

    def _request_raw(self, url: str) -> bytes:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        if self.user_id:
            headers["X-Agent-User-Id"] = self.user_id
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            resp_body = e.read().decode("utf-8") if e.fp else ""
            raise RuntimeError(f"Platform API error {e.code} {url}: {resp_body}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Platform API connection error {url}: {e.reason}") from e
