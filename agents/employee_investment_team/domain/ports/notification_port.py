from __future__ import annotations

from abc import ABC, abstractmethod


class NotificationPort(ABC):
    @abstractmethod
    def notify(self, profile, decision) -> None:
        ...
