from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class WorkflowResultDTO:
    draft_id: str
    employee_id: str
    topic: str
    team_name: str
    summary: str
    consensus: list[str] = field(default_factory=list)
    disagreements: list[str] = field(default_factory=list)
    actions: list[str] = field(default_factory=list)
    notification_targets: list[str] = field(default_factory=list)
