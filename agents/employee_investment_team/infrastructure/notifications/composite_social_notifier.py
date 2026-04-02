from __future__ import annotations

from employee_investment_team.domain.ports.notification_port import NotificationPort


class CompositeSocialNotifier(NotificationPort):
    def __init__(self, notifiers: list[NotificationPort], logger=None) -> None:
        self._notifiers = notifiers
        self._logger = logger

    def notify(self, profile, decision) -> None:
        for notifier in self._notifiers:
            if self._logger:
                self._logger.log(
                    "social_notification_dispatching",
                    employee_id=profile.employee_id,
                    notifier=notifier.__class__.__name__,
                    topic=decision.topic,
                )
            notifier.notify(profile, decision)
