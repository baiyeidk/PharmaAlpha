from __future__ import annotations

from abc import ABC, abstractmethod


class SOPExtractorPort(ABC):
    @abstractmethod
    def extract(self, profile):
        ...
