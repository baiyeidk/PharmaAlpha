from __future__ import annotations

from abc import ABC, abstractmethod


class WorkflowOrchestratorPort(ABC):
    @abstractmethod
    def run(self, draft_id: str):
        ...
