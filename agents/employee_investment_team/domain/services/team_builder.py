from __future__ import annotations

from ..entities.employee_profile import EmployeeProfile


DEFAULT_ROLES = {
    "research": ["data_analysis", "financial_analysis", "policy_monitoring"],
    "investment": ["financial_analysis", "risk_control", "policy_monitoring"],
    "strategy": ["data_analysis", "competitive_tracking", "policy_monitoring"],
}


def build_team_name(profile: EmployeeProfile) -> str:
    return f"{profile.name} Investment Squad"


def recommend_roles(profile: EmployeeProfile) -> list[str]:
    for key, roles in DEFAULT_ROLES.items():
        if key in profile.department.lower() or key in profile.title.lower():
            return roles
    return ["data_analysis", "financial_analysis", "policy_monitoring"]
