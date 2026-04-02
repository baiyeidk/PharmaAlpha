from __future__ import annotations

import uuid

from employee_investment_team.domain.entities.workflow_draft import WorkflowNode


class BaseWorkflowBuilder:
    def build(self, roles: list[str]) -> list[WorkflowNode]:
        nodes: list[WorkflowNode] = []
        for role in roles:
            nodes.append(
                WorkflowNode(
                    node_id=str(uuid.uuid4()),
                    node_type=role,
                    title=role.replace("_", " ").title(),
                )
            )
        analysis_ids = [node.node_id for node in nodes]
        synth_node = WorkflowNode(
            node_id=str(uuid.uuid4()),
            node_type="synthesize",
            title="Synthesize Discussion",
            depends_on=analysis_ids,
        )
        notify_node = WorkflowNode(
            node_id=str(uuid.uuid4()),
            node_type="notify",
            title="Notify Stakeholders",
            depends_on=[synth_node.node_id],
        )
        nodes.extend([synth_node, notify_node])
        return nodes
