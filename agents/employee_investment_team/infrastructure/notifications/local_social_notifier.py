from __future__ import annotations

from employee_investment_team.domain.ports.notification_port import NotificationPort


class LocalSocialNotifier(NotificationPort):
    def __init__(self, logger=None) -> None:
        self._logger = logger

    def notify(self, profile, decision) -> None:
        targets = profile.social_accounts or []
        payload = {
            "employee_id": profile.employee_id,
            "targets": targets,
            "topic": decision.topic,
            "summary": decision.summary,
            "actions": decision.actions,
        }
        if self._logger:
            self._logger.log(
                "social_notification_pseudo_prepared",
                channel="local-social",
                employee_id=profile.employee_id,
                target_count=len(targets),
                payload=payload,
                note="Pseudo delivery only. Replace with enterprise social platform adapter later.",
            )
