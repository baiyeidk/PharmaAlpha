from __future__ import annotations

from abc import ABC, abstractmethod


class ProfileRepositoryPort(ABC):
    @abstractmethod
    def get_by_id(self, employee_id: str):
        ...

    @abstractmethod
    def save(self, profile) -> None:
        ...

    @abstractmethod
    def bootstrap(self, employee_id: str):
        ...
