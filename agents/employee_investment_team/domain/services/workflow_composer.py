from __future__ import annotations

import uuid

from employee_investment_team.domain.entities.workflow_draft import WorkflowNode
from employee_investment_team.domain.value_objects.skill_extension import SkillExtension


class WorkflowComposer:
    def compose(
        self,
        base_nodes: list[WorkflowNode],
        extensions: list[SkillExtension],
    ) -> list[WorkflowNode]:
        nodes = [self._clone_node(node) for node in base_nodes]
        synth_node = next((node for node in nodes if node.node_type == "synthesize"), None)

        for extension in extensions:
            created_nodes: list[WorkflowNode] = []
            for blueprint in extension.nodes:
                dependency_ids = self._resolve_dependencies(nodes, blueprint.depends_on_types)
                node = WorkflowNode(
                    node_id=str(uuid.uuid4()),
                    node_type=blueprint.node_type,
                    title=blueprint.title,
                    depends_on=dependency_ids,
                    skill_name=extension.skill_name,
                    sop_name=blueprint.sop_name,
                    params=blueprint.params,
                )
                created_nodes.append(node)
                nodes.append(node)

            if synth_node is not None:
                created_ids = [node.node_id for node in created_nodes]
                if extension.merge_mode == "parallel":
                    synth_node.depends_on.extend(created_ids)
                elif extension.merge_mode == "merge" and created_ids:
                    synth_node.depends_on.extend(created_ids)

        if synth_node is not None:
            synth_node.depends_on = list(dict.fromkeys(synth_node.depends_on))
        return nodes

    def _clone_node(self, node: WorkflowNode) -> WorkflowNode:
        return WorkflowNode(
            node_id=node.node_id,
            node_type=node.node_type,
            title=node.title,
            depends_on=list(node.depends_on),
            enabled=node.enabled,
            skill_name=node.skill_name,
            sop_name=node.sop_name,
            params=dict(node.params),
        )

    def _resolve_dependencies(self, nodes: list[WorkflowNode], node_types: list[str]) -> list[str]:
        if not node_types:
            return []
        return [node.node_id for node in nodes if node.node_type in node_types and node.enabled]
