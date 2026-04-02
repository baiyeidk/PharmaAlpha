from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base import BaseAgent

from employee_investment_team.application.services.investment_team_service import (
    InvestmentTeamService,
)
from employee_investment_team.infrastructure.db.postgres import PostgresDatabase
from employee_investment_team.infrastructure.extractors.sop_extractor import (
    SimpleSOPExtractor,
)
from employee_investment_team.infrastructure.logging.structured_logger import (
    StructuredLogger,
)
from employee_investment_team.infrastructure.llm.deepseek_chat_model import (
    DeepSeekChatModel,
)
from employee_investment_team.infrastructure.notifications.composite_social_notifier import (
    CompositeSocialNotifier,
)
from employee_investment_team.infrastructure.notifications.local_social_notifier import (
    LocalSocialNotifier,
)
from employee_investment_team.infrastructure.notifications.webhook_social_notifier import (
    WebhookSocialNotifier,
)
from employee_investment_team.infrastructure.orchestration.langgraph_orchestrator import (
    LangGraphInvestmentOrchestrator,
)
from employee_investment_team.infrastructure.repositories.postgres_employee_profile_repository import (
    PostgresEmployeeProfileRepository,
)
from employee_investment_team.infrastructure.repositories.postgres_skill_cache import (
    PostgresSkillCache,
)
from employee_investment_team.infrastructure.repositories.postgres_workflow_draft_repository import (
    PostgresWorkflowDraftRepository,
)
from employee_investment_team.presentation.handlers import handle_request


class EmployeeInvestmentTeamAgent(BaseAgent):
    def __init__(self) -> None:
        logger = StructuredLogger()
        database = PostgresDatabase()
        service = InvestmentTeamService(
            profile_repository=PostgresEmployeeProfileRepository(database),
            sop_extractor=SimpleSOPExtractor(),
            skill_cache=PostgresSkillCache(database),
            workflow_repository=PostgresWorkflowDraftRepository(database),
            llm=DeepSeekChatModel(),
            notifier=CompositeSocialNotifier(
                [
                    LocalSocialNotifier(logger=logger),
                    WebhookSocialNotifier(logger=logger),
                ],
                logger=logger,
            ),
            logger=logger,
        )
        service.set_orchestrator(LangGraphInvestmentOrchestrator(service=service))
        self._service = service
        self._logger = logger

    def execute(self, request):
        yield from handle_request(request, self._service, self._logger)


if __name__ == "__main__":
    EmployeeInvestmentTeamAgent().run()
