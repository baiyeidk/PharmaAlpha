from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class LLMPort(ABC):
    @abstractmethod
    def complete(
        self,
        messages: list[dict[str, str]],
        model: str,
        stream: bool = False,
        **kwargs: Any,
    ) -> str:
        ...
