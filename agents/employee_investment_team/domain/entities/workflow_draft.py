from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class WorkflowNode:
    node_id: str
    node_type: str
    title: str
    depends_on: list[str] = field(default_factory=list)
    enabled: bool = True
    skill_name: str | None = None
    sop_name: str | None = None
    params: dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowDraft:
    draft_id: str
    employee_id: str
    topic: str
    status: str
    selected_skills: list[str] = field(default_factory=list)
    team_members: list[dict[str, Any]] = field(default_factory=list)
    nodes: list[WorkflowNode] = field(default_factory=list)
