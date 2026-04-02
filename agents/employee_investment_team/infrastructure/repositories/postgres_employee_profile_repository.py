from __future__ import annotations

import uuid

from employee_investment_team.domain.entities.employee_profile import EmployeeProfile
from employee_investment_team.domain.ports.profile_repository_port import (
    ProfileRepositoryPort,
)
from employee_investment_team.infrastructure.db.postgres import PostgresDatabase


class PostgresEmployeeProfileRepository(ProfileRepositoryPort):
    def __init__(self, database: PostgresDatabase) -> None:
        self._db = database

    def get_by_id(self, employee_id: str):
        row = self._db.fetch_one(
            """
            SELECT ep."employeeCode", ep."displayName", ep."title", ep."department",
                   ep."focusAreas", ep."tags",
                   COALESCE(
                     ARRAY(
                       SELECT eo."content"
                       FROM "EmployeeObservation" eo
                       WHERE eo."employeeProfileId" = ep."id"
                       ORDER BY eo."observedAt" DESC
                       LIMIT 10
                     ),
                     ARRAY[]::TEXT[]
                   ) AS observation_notes,
                   COALESCE(
                     ARRAY(
                       SELECT eib."action" || ':' || eib."target"
                       FROM "EmployeeInvestmentBehavior" eib
                       WHERE eib."employeeProfileId" = ep."id"
                       ORDER BY eib."decidedAt" DESC
                       LIMIT 10
                     ),
                     ARRAY[]::TEXT[]
                   ) AS investment_behaviors,
                   COALESCE(
                     ARRAY(
                       SELECT esa."platform" || '://' || esa."accountRef"
                       FROM "EmployeeSocialAccount" esa
                       WHERE esa."employeeProfileId" = ep."id" AND esa."isActive" = true
                     ),
                     ARRAY[]::TEXT[]
                   ) AS social_accounts
            FROM "EmployeeProfile" ep
            WHERE ep."employeeCode" = %s
            """,
            (employee_id,),
        )
        if row is None:
            return None
        return EmployeeProfile(
            employee_id=row["employeeCode"],
            name=row["displayName"],
            title=row["title"],
            department=row["department"],
            focus_areas=row["focusAreas"] or [],
            tags=row["tags"] or [],
            observation_notes=row["observation_notes"] or [],
            investment_behaviors=row["investment_behaviors"] or [],
            social_accounts=row["social_accounts"] or [],
        )

    def save(self, profile) -> None:
        self._db.execute(
            """
            UPDATE "EmployeeProfile"
            SET "displayName" = %s,
                "title" = %s,
                "department" = %s,
                "focusAreas" = %s,
                "tags" = %s,
                "updatedAt" = NOW()
            WHERE "employeeCode" = %s
            """,
            (
                profile.name,
                profile.title,
                profile.department,
                profile.focus_areas,
                profile.tags,
                profile.employee_id,
            ),
        )

    def bootstrap(self, employee_id: str):
        user_id = str(uuid.uuid4())
        profile_id = str(uuid.uuid4())
        social_account_id = str(uuid.uuid4())
        user = self._db.execute_returning(
            """
            INSERT INTO "User" ("id", "name", "email", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, NOW(), NOW())
            ON CONFLICT ("email") DO UPDATE SET "updatedAt" = NOW()
            RETURNING "id"
            """,
            (user_id, f"Employee {employee_id}", f"{employee_id}@local.agent"),
        )
        self._db.execute(
            """
            INSERT INTO "EmployeeProfile"
            ("id", "userId", "employeeCode", "displayName", "title", "department", "focusAreas", "tags", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT ("employeeCode") DO NOTHING
            """,
            (
                profile_id,
                user["id"],
                employee_id,
                f"Employee {employee_id}",
                "Investment Researcher",
                "Investment Research",
                ["biotech", "innovative_drugs"],
                ["research"],
            ),
        )
        self._db.execute(
            """
            INSERT INTO "EmployeeSocialAccount"
            ("id", "employeeProfileId", "platform", "accountRef", "isActive", "createdAt", "updatedAt")
            SELECT %s, ep."id", 'internal', %s, true, NOW(), NOW()
            FROM "EmployeeProfile" ep
            WHERE ep."employeeCode" = %s
            ON CONFLICT ("employeeProfileId", "platform", "accountRef") DO NOTHING
            """,
            (social_account_id, employee_id, employee_id),
        )
        return self.get_by_id(employee_id)
