from __future__ import annotations

import json
import os
import urllib.request

from employee_investment_team.domain.ports.notification_port import NotificationPort


class WebhookSocialNotifier(NotificationPort):
    def __init__(self, webhook_url: str | None = None, logger=None) -> None:
        self._webhook_url = webhook_url or os.getenv("SOCIAL_WEBHOOK_URL")
        self._logger = logger

    def notify(self, profile, decision) -> None:
        payload_dict = {
            "employee_id": profile.employee_id,
            "targets": profile.social_accounts,
            "topic": decision.topic,
            "summary": decision.summary,
            "actions": decision.actions,
        }
        if self._logger:
            self._logger.log(
                "social_notification_webhook_prepared",
                channel="webhook-social",
                enabled=bool(self._webhook_url),
                employee_id=profile.employee_id,
                payload=payload_dict,
                note="Pseudo integration. This adapter can be replaced with WeCom/DingTalk later.",
            )
        if not self._webhook_url:
            return

        payload = json.dumps(payload_dict).encode("utf-8")
        request = urllib.request.Request(
            self._webhook_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                if self._logger:
                    self._logger.log(
                        "social_notification_webhook_sent",
                        channel="webhook-social",
                        employee_id=profile.employee_id,
                        status=getattr(response, "status", None),
                    )
        except Exception as exc:
            if self._logger:
                self._logger.log(
                    "social_notification_webhook_failed",
                    channel="webhook-social",
                    employee_id=profile.employee_id,
                    error=str(exc),
                )
