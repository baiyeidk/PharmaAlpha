from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class SOP:
    steps: list[str] = field(default_factory=list)
    risk_checks: list[str] = field(default_factory=list)
    decision_style: str = "balanced"
