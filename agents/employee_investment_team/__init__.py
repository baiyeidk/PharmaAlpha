__all__ = [
    "EmployeeInvestmentTeamAgent",
    "InvestmentTeamService",
    "build_discussion_messages",
    "build_node_messages",
    "parse_discussion_response",
]


def __getattr__(name: str):
    if name == "EmployeeInvestmentTeamAgent":
        from .agent import EmployeeInvestmentTeamAgent

        return EmployeeInvestmentTeamAgent
    if name == "InvestmentTeamService":
        from .application.services.investment_team_service import InvestmentTeamService

        return InvestmentTeamService
    if name in {"build_discussion_messages", "build_node_messages", "parse_discussion_response"}:
        from .capabilities import (
            build_discussion_messages,
            build_node_messages,
            parse_discussion_response,
        )

        return {
            "build_discussion_messages": build_discussion_messages,
            "build_node_messages": build_node_messages,
            "parse_discussion_response": parse_discussion_response,
        }[name]
    raise AttributeError(name)
