from __future__ import annotations

import uuid

from employee_investment_team.domain.ports.skill_cache_port import SkillCachePort
from employee_investment_team.domain.value_objects.skill_definition import SkillDefinition
from employee_investment_team.infrastructure.db.postgres import PostgresDatabase


class PostgresSkillCache(SkillCachePort):
    def __init__(self, database: PostgresDatabase) -> None:
        self._db = database

    def list_for_user(self, user_id: str) -> list[SkillDefinition]:
        rows = self._db.fetch_all(
            """
            SELECT sd."name", sd."description", sd."metadata"
            FROM "SkillDefinition" sd
            INNER JOIN "EmployeeProfile" ep ON ep."id" = sd."employeeProfileId"
            WHERE ep."employeeCode" = %s
            ORDER BY sd."createdAt" ASC
            """,
            (user_id,),
        )
        return [
            SkillDefinition(
                user_id=user_id,
                name=row["name"],
                description=row["description"],
                metadata=row["metadata"] or {},
            )
            for row in rows
        ]

    def put(self, user_id: str, skill: SkillDefinition) -> None:
        skill_id = str(uuid.uuid4())
        self._db.execute(
            """
            INSERT INTO "SkillDefinition"
            ("id", "employeeProfileId", "name", "description", "metadata", "createdAt", "updatedAt")
            SELECT %s, ep."id", %s, %s, %s::jsonb, NOW(), NOW()
            FROM "EmployeeProfile" ep
            WHERE ep."employeeCode" = %s
            ON CONFLICT ("employeeProfileId", "name")
            DO UPDATE SET
                "description" = EXCLUDED."description",
                "metadata" = EXCLUDED."metadata",
                "updatedAt" = NOW()
            """,
            (
                skill_id,
                skill.name,
                skill.description,
                self._db.dumps(skill.metadata),
                user_id,
            ),
        )
