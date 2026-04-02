from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class SkillNodeBlueprint:
    node_type: str
    title: str
    merge_mode: str = "parallel"
    depends_on_types: list[str] = field(default_factory=list)
    sop_name: str | None = None
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SkillExtension:
    skill_name: str
    merge_mode: str = "parallel"
    nodes: list[SkillNodeBlueprint] = field(default_factory=list)
