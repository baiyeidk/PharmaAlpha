from __future__ import annotations

import json
from pathlib import Path

from employee_investment_team.domain.ports.skill_cache_port import SkillCachePort
from employee_investment_team.domain.value_objects.skill_definition import SkillDefinition
from employee_investment_team.infrastructure.cache.mappers.skill_cache_mapper import (
    SkillCacheMapper,
)


class LocalSkillCache(SkillCachePort):
    def __init__(self, cache_file: str | None = None) -> None:
        base_dir = Path(__file__).resolve().parents[2]
        self._cache_file = Path(cache_file) if cache_file else base_dir / ".cache" / "skills.json"
        self._cache_file.parent.mkdir(parents=True, exist_ok=True)
        if not self._cache_file.exists():
            self._write({})

    def list_for_user(self, user_id: str) -> list[SkillDefinition]:
        records = self._read().get(user_id, [])
        return [SkillCacheMapper.from_record(record) for record in records]

    def put(self, user_id: str, skill: SkillDefinition) -> None:
        data = self._read()
        skills = data.setdefault(user_id, [])
        record = SkillCacheMapper.to_record(skill)
        existing_idx = next(
            (index for index, item in enumerate(skills) if item.get("name") == skill.name),
            None,
        )
        if existing_idx is None:
            skills.append(record)
        else:
            skills[existing_idx] = record
        self._write(data)

    def _read(self) -> dict[str, list[dict]]:
        return json.loads(self._cache_file.read_text(encoding="utf-8"))

    def _write(self, data: dict[str, list[dict]]) -> None:
        self._cache_file.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
