from __future__ import annotations

import os
from typing import Any

from openai import OpenAI

from employee_investment_team.domain.ports.llm_port import LLMPort


class DeepSeekChatModel(LLMPort):
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://api.deepseek.com",
        timeout: float | None = 8.0,
    ) -> None:
        resolved_key = api_key or os.environ.get("DEEPSEEK_API_KEY")
        if not resolved_key:
            raise ValueError("DEEPSEEK_API_KEY is required for DeepSeekChatModel")

        self._client = OpenAI(
            api_key=resolved_key,
            base_url=base_url,
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
