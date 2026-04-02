from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class EmployeeProfile:
    employee_id: str
    name: str
    title: str
    department: str
    focus_areas: list[str]
    tags: list[str]
    observation_notes: list[str] = field(default_factory=list)
    investment_behaviors: list[str] = field(default_factory=list)
    social_accounts: list[str] = field(default_factory=list)
