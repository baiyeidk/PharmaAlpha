from __future__ import annotations

import json
from pathlib import Path

from employee_investment_team.domain.entities.workflow_draft import (
    WorkflowDraft,
    WorkflowNode,
)
from employee_investment_team.domain.ports.workflow_draft_repository_port import (
    WorkflowDraftRepositoryPort,
)


class LocalWorkflowDraftRepository(WorkflowDraftRepositoryPort):
    def __init__(self, storage_file: str | None = None) -> None:
        base_dir = Path(__file__).resolve().parents[2]
        self._storage_file = (
            Path(storage_file) if storage_file else base_dir / ".cache" / "workflow_drafts.json"
        )
        self._storage_file.parent.mkdir(parents=True, exist_ok=True)
        if not self._storage_file.exists():
            self._write({})

    def get_by_id(self, draft_id: str):
        payload = self._read().get(draft_id)
        if payload is None:
            return None
        return self._from_record(payload)

    def save(self, draft) -> None:
        data = self._read()
        data[draft.draft_id] = self._to_record(draft)
        self._write(data)

    def list_for_employee(self, employee_id: str) -> list[WorkflowDraft]:
        return [
            self._from_record(record)
            for record in self._read().values()
            if record["employee_id"] == employee_id
        ]

    def _to_record(self, draft: WorkflowDraft) -> dict:
        return {
            "draft_id": draft.draft_id,
            "employee_id": draft.employee_id,
            "topic": draft.topic,
            "status": draft.status,
            "selected_skills": draft.selected_skills,
            "nodes": [
                {
                    "node_id": node.node_id,
                    "node_type": node.node_type,
                    "title": node.title,
                    "depends_on": node.depends_on,
                    "enabled": node.enabled,
                    "skill_name": node.skill_name,
                    "sop_name": node.sop_name,
                    "params": node.params,
                }
                for node in draft.nodes
            ],
        }

    def _from_record(self, record: dict) -> WorkflowDraft:
        return WorkflowDraft(
            draft_id=record["draft_id"],
            employee_id=record["employee_id"],
            topic=record["topic"],
            status=record["status"],
            selected_skills=record.get("selected_skills", []),
            nodes=[
                WorkflowNode(
                    node_id=node["node_id"],
                    node_type=node["node_type"],
                    title=node["title"],
                    depends_on=node.get("depends_on", []),
                    enabled=node.get("enabled", True),
                    skill_name=node.get("skill_name"),
                    sop_name=node.get("sop_name"),
                    params=node.get("params", {}),
                )
                for node in record.get("nodes", [])
            ],
        )

    def _read(self) -> dict:
        return json.loads(self._storage_file.read_text(encoding="utf-8"))

    def _write(self, data: dict) -> None:
        self._storage_file.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
