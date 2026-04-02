__all__ = [
    "LocalSkillCache",
    "InMemoryEmployeeProfileRepository",
    "LocalWorkflowDraftRepository",
    "SimpleSOPExtractor",
    "DeepSeekChatModel",
    "CompositeSocialNotifier",
    "LocalSocialNotifier",
    "WebhookSocialNotifier",
    "LangGraphInvestmentOrchestrator",
]


def __getattr__(name: str):
    if name == "LocalSkillCache":
        from .cache.local_skill_cache import LocalSkillCache

        return LocalSkillCache
    if name == "InMemoryEmployeeProfileRepository":
        from .repositories.employee_profile_repository import InMemoryEmployeeProfileRepository

        return InMemoryEmployeeProfileRepository
    if name == "LocalWorkflowDraftRepository":
        from .repositories.workflow_draft_repository import LocalWorkflowDraftRepository

        return LocalWorkflowDraftRepository
    if name == "SimpleSOPExtractor":
        from .extractors.sop_extractor import SimpleSOPExtractor

        return SimpleSOPExtractor
    if name == "DeepSeekChatModel":
        from .llm.deepseek_chat_model import DeepSeekChatModel

        return DeepSeekChatModel
    if name == "CompositeSocialNotifier":
        from .notifications.composite_social_notifier import CompositeSocialNotifier

        return CompositeSocialNotifier
    if name == "LocalSocialNotifier":
        from .notifications.local_social_notifier import LocalSocialNotifier

        return LocalSocialNotifier
    if name == "WebhookSocialNotifier":
        from .notifications.webhook_social_notifier import WebhookSocialNotifier

        return WebhookSocialNotifier
    if name == "LangGraphInvestmentOrchestrator":
        from .orchestration.langgraph_orchestrator import LangGraphInvestmentOrchestrator

        return LangGraphInvestmentOrchestrator
    raise AttributeError(name)
