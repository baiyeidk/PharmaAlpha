from __future__ import annotations

from abc import ABC, abstractmethod


class WorkflowDraftRepositoryPort(ABC):
    @abstractmethod
    def get_by_id(self, draft_id: str):
        ...

    @abstractmethod
    def save(self, draft) -> None:
        ...

    @abstractmethod
    def list_for_employee(self, employee_id: str) -> list:
        ...
