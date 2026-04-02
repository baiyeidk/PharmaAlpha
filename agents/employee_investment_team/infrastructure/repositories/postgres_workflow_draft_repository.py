from __future__ import annotations

import uuid

from employee_investment_team.domain.entities.workflow_draft import WorkflowDraft, WorkflowNode
from employee_investment_team.domain.ports.workflow_draft_repository_port import (
    WorkflowDraftRepositoryPort,
)
from employee_investment_team.infrastructure.db.postgres import PostgresDatabase


class PostgresWorkflowDraftRepository(WorkflowDraftRepositoryPort):
    def __init__(self, database: PostgresDatabase) -> None:
        self._db = database

    def get_by_id(self, draft_id: str):
        draft_row = self._db.fetch_one(
            """
            SELECT wd."id", ep."employeeCode", wd."topic", wd."status", wd."selectedSkills", wd."config"
            FROM "WorkflowDraft" wd
            INNER JOIN "EmployeeProfile" ep ON ep."id" = wd."employeeProfileId"
            WHERE wd."id" = %s
            """,
            (draft_id,),
        )
        if draft_row is None:
            return None
        node_rows = self._db.fetch_all(
            """
            SELECT wn."id", wn."nodeKey", wn."nodeType", wn."title", wn."dependsOn",
                   wn."enabled", sd."name" AS "skillName", ss."name" AS "sopName", wn."params"
            FROM "WorkflowNode" wn
            LEFT JOIN "SkillDefinition" sd ON sd."id" = wn."skillDefinitionId"
            LEFT JOIN "SkillSop" ss ON ss."id" = wn."skillSopId"
            WHERE wn."workflowDraftId" = %s
            ORDER BY wn."createdAt" ASC
            """,
            (draft_id,),
        )
        return WorkflowDraft(
            draft_id=draft_row["id"],
            employee_id=draft_row["employeeCode"],
            topic=draft_row["topic"],
            status=draft_row["status"],
            selected_skills=draft_row["selectedSkills"] or [],
            team_members=(draft_row["config"] or {}).get("team_members", []),
            nodes=[
                WorkflowNode(
                    node_id=row["nodeKey"],
                    node_type=row["nodeType"],
                    title=row["title"],
                    depends_on=row["dependsOn"] or [],
                    enabled=row["enabled"],
                    skill_name=row["skillName"],
                    sop_name=row["sopName"],
                    params=row["params"] or {},
                )
                for row in node_rows
            ],
        )

    def save(self, draft) -> None:
        draft_row = self._db.execute_returning(
            """
            INSERT INTO "WorkflowDraft"
            ("id", "employeeProfileId", "topic", "status", "selectedSkills", "config", "createdAt", "updatedAt")
            SELECT %s, ep."id", %s, %s, %s::jsonb, %s::jsonb, NOW(), NOW()
            FROM "EmployeeProfile" ep
            WHERE ep."employeeCode" = %s
            ON CONFLICT ("id")
            DO UPDATE SET
                "topic" = EXCLUDED."topic",
                "status" = EXCLUDED."status",
                "selectedSkills" = EXCLUDED."selectedSkills",
                "config" = EXCLUDED."config",
                "updatedAt" = NOW()
            RETURNING "id"
            """,
            (
                draft.draft_id,
                draft.topic,
                draft.status,
                self._db.dumps(draft.selected_skills),
                self._db.dumps({"team_members": draft.team_members}),
                draft.employee_id,
            ),
        )
        workflow_draft_id = draft_row["id"]
        self._db.execute('DELETE FROM "WorkflowNode" WHERE "workflowDraftId" = %s', (workflow_draft_id,))
        candidate_employee_codes = [draft.employee_id, *[member.get("employee_id") for member in draft.team_members]]
        for node in draft.nodes:
            workflow_node_id = str(uuid.uuid4())
            skill_definition_id = None
            skill_sop_id = None
            if node.skill_name:
                owner_employee_id = (node.params or {}).get("owner_employee_id")
                employee_codes = [owner_employee_id] if owner_employee_id else candidate_employee_codes
                skill_row = self._db.fetch_one(
                    """
                    SELECT sd."id"
                    FROM "SkillDefinition" sd
                    INNER JOIN "EmployeeProfile" ep ON ep."id" = sd."employeeProfileId"
                    WHERE ep."employeeCode" = ANY(%s) AND sd."name" = %s
                    ORDER BY CASE WHEN ep."employeeCode" = %s THEN 0 ELSE 1 END
                    """,
                    (employee_codes, node.skill_name, owner_employee_id or draft.employee_id),
                )
                if skill_row:
                    skill_definition_id = skill_row["id"]
                    if node.sop_name:
                        sop_row = self._db.fetch_one(
                            """
                            SELECT ss."id"
                            FROM "SkillSop" ss
                            WHERE ss."skillDefinitionId" = %s AND ss."name" = %s
                            """,
                            (skill_definition_id, node.sop_name),
                        )
                        if sop_row:
                            skill_sop_id = sop_row["id"]
            self._db.execute(
                """
                INSERT INTO "WorkflowNode"
                ("id", "workflowDraftId", "nodeKey", "nodeType", "title", "dependsOn",
                 "enabled", "skillDefinitionId", "skillSopId", "params", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s::jsonb, NOW(), NOW())
                """,
                (
                    workflow_node_id,
                    workflow_draft_id,
                    node.node_id,
                    node.node_type,
                    node.title,
                    self._db.dumps(node.depends_on),
                    node.enabled,
                    skill_definition_id,
                    skill_sop_id,
                    self._db.dumps(node.params),
                ),
            )

    def list_for_employee(self, employee_id: str) -> list[WorkflowDraft]:
        rows = self._db.fetch_all(
            """
            SELECT wd."id"
            FROM "WorkflowDraft" wd
            INNER JOIN "EmployeeProfile" ep ON ep."id" = wd."employeeProfileId"
            WHERE ep."employeeCode" = %s
            ORDER BY wd."createdAt" DESC
            """,
            (employee_id,),
        )
        return [self.get_by_id(row["id"]) for row in rows]
