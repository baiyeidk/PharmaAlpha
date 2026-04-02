from __future__ import annotations

from abc import ABC, abstractmethod

from employee_investment_team.domain.value_objects.skill_definition import SkillDefinition


class SkillCachePort(ABC):
    @abstractmethod
    def list_for_user(self, user_id: str) -> list[SkillDefinition]:
        ...

    @abstractmethod
    def put(self, user_id: str, skill: SkillDefinition) -> None:
        ...
