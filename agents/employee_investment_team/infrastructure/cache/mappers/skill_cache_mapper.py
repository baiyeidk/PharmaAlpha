from __future__ import annotations

from employee_investment_team.domain.value_objects.skill_definition import SkillDefinition


class SkillCacheMapper:
    @staticmethod
    def to_record(skill: SkillDefinition) -> dict:
        return {
            "user_id": skill.user_id,
            "name": skill.name,
            "description": skill.description,
            "metadata": skill.metadata,
        }

    @staticmethod
    def from_record(record: dict) -> SkillDefinition:
        return SkillDefinition(
            user_id=record["user_id"],
            name=record["name"],
            description=record.get("description", ""),
            metadata=record.get("metadata", {}),
        )
