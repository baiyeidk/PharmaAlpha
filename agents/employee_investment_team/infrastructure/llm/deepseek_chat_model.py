from __future__ import annotations

import os
from typing import Any

from openai import OpenAI

from employee_investment_team.domain.ports.llm_port import LLMPort


class DeepSeekChatModel(LLMPort):
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: float | None = 8.0,
    ) -> None:
        resolved_key = (
            api_key
            or os.environ.get("LLM_API_KEY")
            or os.environ.get("DEEPSEEK_API_KEY")
        )
        if not resolved_key:
            raise ValueError(
                "LLM API key is required. Set LLM_API_KEY or DEEPSEEK_API_KEY."
            )
        resolved_base = (
            base_url
            or os.environ.get("LLM_BASE_URL")
            or "https://api.deepseek.com"
        )

        self._client = OpenAI(
            api_key=resolved_key,
            base_url=resolved_base,
            timeout=timeout,
            max_retries=0,
        )

    def complete(
        self,
        messages: list[dict[str, str]],
        model: str,
        stream: bool = False,
        **kwargs: Any,
    ) -> str:
        response = self._client.chat.completions.create(
            model=model,
            messages=messages,
            stream=stream,
            **kwargs,
        )
        return response.choices[0].message.content or ""
