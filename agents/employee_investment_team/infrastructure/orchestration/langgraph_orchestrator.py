from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from employee_investment_team.domain.entities.workflow_draft import WorkflowNode
from employee_investment_team.domain.ports.workflow_orchestrator_port import (
    WorkflowOrchestratorPort,
)


class WorkflowState(TypedDict, total=False):
    draft_id: str
    draft: Any
    profile: Any
    sop: Any
    cached_skills: list[Any]
    analyses: dict[str, str]
    discussion: dict
    notification_status: str


class LangGraphInvestmentOrchestrator(WorkflowOrchestratorPort):
    def __init__(self, service) -> None:
        self._service = service
        self._bootstrap_graph = self._build_bootstrap_graph()

    def run(self, draft_id: str):
        state = self._bootstrap_graph.invoke({"draft_id": draft_id, "analyses": {}})
        graph = self._build_execution_graph(state["draft"])
        return graph.invoke(state)

    def _build_bootstrap_graph(self):
        graph = StateGraph(WorkflowState)
        graph.add_node("hydrate_context", self._service.node_hydrate_context)
        graph.add_edge(START, "hydrate_context")
        graph.add_edge("hydrate_context", END)
        return graph.compile()

    def _build_execution_graph(self, draft) -> Any:
        graph = StateGraph(WorkflowState)
        enabled_nodes = [node for node in draft.nodes if node.enabled]

        for node in enabled_nodes:
            graph.add_node(node.node_id, self._make_handler(node))

        start_nodes = [node for node in enabled_nodes if not node.depends_on]
        for node in start_nodes:
            graph.add_edge(START, node.node_id)

        for node in enabled_nodes:
            downstream = [candidate for candidate in enabled_nodes if node.node_id in candidate.depends_on]
            if downstream:
                for candidate in downstream:
                    graph.add_edge(node.node_id, candidate.node_id)
            else:
                graph.add_edge(node.node_id, END)

        return graph.compile()

    def _make_handler(self, node: WorkflowNode):
        if node.node_type == "synthesize":
            return lambda state: self._service.execute_synthesis_node(state, node)
        if node.node_type == "notify":
            return lambda state: self._service.execute_notify_node(state, node)
        return lambda state: self._service.execute_analysis_node(state, node)
