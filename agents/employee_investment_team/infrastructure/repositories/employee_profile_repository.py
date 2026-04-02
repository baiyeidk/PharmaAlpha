from __future__ import annotations

from employee_investment_team.domain.entities.employee_profile import EmployeeProfile
from employee_investment_team.domain.ports.profile_repository_port import (
    ProfileRepositoryPort,
)


class InMemoryEmployeeProfileRepository(ProfileRepositoryPort):
    def __init__(self) -> None:
        self._profiles: dict[str, EmployeeProfile] = {}

    def get_by_id(self, employee_id: str):
        return self._profiles.get(employee_id)

    def save(self, profile) -> None:
        self._profiles[profile.employee_id] = profile

    def bootstrap(self, employee_id: str):
        profile = EmployeeProfile(
            employee_id=employee_id,
            name=f"Employee {employee_id}",
            title="Investment Researcher",
            department="Investment Research",
            focus_areas=["biotech", "innovative_drugs"],
            tags=["research", "employee-skill"],
            observation_notes=["Tracks policy updates and company disclosures."],
            investment_behaviors=["Prefers evidence-backed discussion before decision."],
            social_accounts=[f"internal://employee/{employee_id}"],
        )
        self.save(profile)
        return profile
