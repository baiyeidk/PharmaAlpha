from __future__ import annotations

from employee_investment_team.domain.value_objects.skill_definition import SkillDefinition


def build_employee_skill(profile, sop) -> dict:
    return {
        "employee_id": profile.employee_id,
        "name": profile.name,
        "title": profile.title,
        "department": profile.department,
        "focus_areas": profile.focus_areas,
        "tags": profile.tags,
        "decision_style": sop.decision_style,
        "sop_steps": sop.steps,
        "risk_checks": sop.risk_checks,
    }


def to_skill_definition(skill: dict) -> SkillDefinition:
    return SkillDefinition(
        user_id=skill["employee_id"],
        name=skill["name"],
        description=f"{skill['title']} skill focused on {', '.join(skill['focus_areas'])}.",
        metadata=skill,
    )
