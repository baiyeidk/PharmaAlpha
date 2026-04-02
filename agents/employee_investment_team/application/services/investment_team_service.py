from __future__ import annotations

import concurrent.futures
import uuid

from employee_investment_team.application.dto.workflow_result import WorkflowResultDTO
from employee_investment_team.capabilities import (
    build_graph_plan_messages,
    build_discussion_messages,
    build_node_messages,
    parse_graph_plan_response,
    parse_discussion_response,
)
from employee_investment_team.domain.entities.workflow_draft import WorkflowDraft, WorkflowNode
from employee_investment_team.domain.ports.llm_port import LLMPort
from employee_investment_team.domain.ports.notification_port import NotificationPort
from employee_investment_team.domain.ports.profile_repository_port import (
    ProfileRepositoryPort,
)
from employee_investment_team.domain.ports.skill_cache_port import SkillCachePort
from employee_investment_team.domain.ports.sop_extractor_port import SOPExtractorPort
from employee_investment_team.domain.ports.workflow_draft_repository_port import (
    WorkflowDraftRepositoryPort,
)
from employee_investment_team.domain.ports.workflow_orchestrator_port import (
    WorkflowOrchestratorPort,
)
from employee_investment_team.domain.services.team_builder import (
    build_team_name,
    recommend_roles,
)
from employee_investment_team.domain.services.workflow_state_machine import (
    can_transition,
    require_transition,
)
from employee_investment_team.domain.value_objects.skill_definition import SkillDefinition
from employee_investment_team.domain.value_objects.skill_extension import (
    SkillExtension,
    SkillNodeBlueprint,
)
from employee_investment_team.domain.services.base_workflow_builder import BaseWorkflowBuilder
from employee_investment_team.domain.services.workflow_composer import WorkflowComposer


class InvestmentTeamService:
    def __init__(
        self,
        profile_repository: ProfileRepositoryPort,
        sop_extractor: SOPExtractorPort,
        skill_cache: SkillCachePort,
        workflow_repository: WorkflowDraftRepositoryPort,
        llm: LLMPort,
        notifier: NotificationPort,
        orchestrator: WorkflowOrchestratorPort | None = None,
        base_workflow_builder: BaseWorkflowBuilder | None = None,
        workflow_composer: WorkflowComposer | None = None,
        logger=None,
    ) -> None:
        self._profile_repository = profile_repository
        self._sop_extractor = sop_extractor
        self._skill_cache = skill_cache
        self._workflow_repository = workflow_repository
        self._llm = llm
        self._notifier = notifier
        self._orchestrator = orchestrator
        self._base_workflow_builder = base_workflow_builder or BaseWorkflowBuilder()
        self._workflow_composer = workflow_composer or WorkflowComposer()
        self._logger = logger

    def list_skills(self, employee_id: str) -> list[SkillDefinition]:
        return self._skill_cache.list_for_user(employee_id)

    def register_skill(
        self,
        employee_id: str,
        name: str,
        description: str,
        metadata: dict | None = None,
    ) -> SkillDefinition:
        skill = SkillDefinition(
            user_id=employee_id,
            name=name,
            description=description,
            metadata=metadata or {},
        )
        self._skill_cache.put(employee_id, skill)
        return skill

    def create_workflow_draft(
        self,
        employee_id: str,
        topic: str,
        selected_skill_names: list[str] | None = None,
        selected_team_members: list[str] | None = None,
    ) -> WorkflowDraft:
        profile = self._ensure_profile(employee_id)
        team_profiles = self._resolve_team_member_profiles(employee_id, selected_team_members or [])
        initiator_skills = self._skill_cache.list_for_user(employee_id)
        team_skill_map = {
            member.employee_id: self._skill_cache.list_for_user(member.employee_id)
            for member in team_profiles
        }
        selected_skill_names = selected_skill_names or []
        selected_skills = self._resolve_selected_skills(employee_id, selected_skill_names)
        nodes = self._plan_graph(
            profile=profile,
            team_profiles=team_profiles,
            topic=topic,
            initiator_skills=initiator_skills,
            team_skill_map=team_skill_map,
            selected_skills=selected_skills,
        )
        draft = WorkflowDraft(
            draft_id=str(uuid.uuid4()),
            employee_id=employee_id,
            topic=topic,
            status="draft",
            selected_skills=[skill.name for skill in selected_skills],
            team_members=[
                {
                    "employee_id": member.employee_id,
                    "name": member.name,
                    "title": member.title,
                    "department": member.department,
                    "focus_areas": member.focus_areas,
                    "tags": member.tags,
                    "skills": [
                        {"name": skill.name, "description": skill.description}
                        for skill in team_skill_map.get(member.employee_id, [])
                    ],
                }
                for member in team_profiles
            ],
            nodes=nodes,
        )
        self._workflow_repository.save(draft)
        self._log(
            "workflow_draft_saved",
            draft_id=draft.draft_id,
            employee_id=employee_id,
            topic=topic,
            selected_skills=draft.selected_skills,
            team_member_count=len(draft.team_members),
            node_count=len(draft.nodes),
        )
        return draft

    def list_workflow_drafts(self, employee_id: str) -> list[WorkflowDraft]:
        return self._workflow_repository.list_for_employee(employee_id)

    def add_node(
        self,
        draft_id: str,
        node_type: str,
        title: str,
        depends_on: list[str] | None = None,
        skill_name: str | None = None,
        sop_name: str | None = None,
        params: dict | None = None,
    ) -> WorkflowDraft:
        draft = self._require_draft(draft_id)
        self._transition_for_edit(draft)
        draft.nodes.append(
            WorkflowNode(
                node_id=str(uuid.uuid4()),
                node_type=node_type,
                title=title,
                depends_on=depends_on or [],
                skill_name=skill_name,
                sop_name=sop_name,
                params=params or {},
            )
        )
        self._workflow_repository.save(draft)
        return draft

    def update_node(self, draft_id: str, node_id: str, updates: dict) -> WorkflowDraft:
        draft = self._require_draft(draft_id)
        self._transition_for_edit(draft)
        node = self._require_node(draft, node_id)
        for key in ["title", "depends_on", "enabled", "skill_name", "sop_name", "params"]:
            if key in updates:
                setattr(node, key, updates[key])
        self._workflow_repository.save(draft)
        return draft

    def delete_node(self, draft_id: str, node_id: str) -> WorkflowDraft:
        draft = self._require_draft(draft_id)
        self._transition_for_edit(draft)
        draft.nodes = [node for node in draft.nodes if node.node_id != node_id]
        for node in draft.nodes:
            node.depends_on = [dependency for dependency in node.depends_on if dependency != node_id]
        self._workflow_repository.save(draft)
        return draft

    def mark_ready(self, draft_id: str) -> WorkflowDraft:
        draft = self._require_draft(draft_id)
        if draft.status in {"draft", "editing", "failed"}:
            draft.status = "ready"
        else:
            require_transition(draft.status, "ready")
        self._validate_draft(draft)
        self._workflow_repository.save(draft)
        return draft

    def confirm_workflow(self, draft_id: str) -> WorkflowDraft:
        draft = self.mark_ready(draft_id)
        require_transition(draft.status, "confirmed")
        draft.status = "confirmed"
        self._workflow_repository.save(draft)
        return draft

    def execute_workflow(self, draft_id: str) -> WorkflowResultDTO:
        if self._orchestrator is None:
            raise ValueError("Workflow orchestrator is required for execute_workflow()")
        draft = self._require_draft(draft_id)
        if draft.status == "paused":
            require_transition("paused", "confirmed")
            draft.status = "confirmed"
        require_transition(draft.status, "running")
        draft.status = "running"
        self._workflow_repository.save(draft)
        self._log("workflow_execution_started", draft_id=draft.draft_id, employee_id=draft.employee_id)

        state = self._orchestrator.run(draft_id=draft_id)
        profile = state["profile"]
        discussion = state["discussion"]
        draft.status = "completed"
        self._workflow_repository.save(draft)
        self._log("workflow_execution_completed", draft_id=draft.draft_id, employee_id=draft.employee_id)

        result = WorkflowResultDTO(
            draft_id=draft.draft_id,
            employee_id=profile.employee_id,
            topic=draft.topic,
            team_name=build_team_name(profile),
            summary=discussion["summary"],
            consensus=discussion["consensus"],
            disagreements=discussion["disagreements"],
            actions=discussion["actions"],
            notification_targets=profile.social_accounts,
        )
        self._notifier.notify(profile, result)
        self._profile_repository.save(profile)
        self._log(
            "workflow_result_persisted",
            draft_id=draft.draft_id,
            employee_id=draft.employee_id,
            notification_targets=result.notification_targets,
        )
        return result

    def set_orchestrator(self, orchestrator: WorkflowOrchestratorPort) -> None:
        self._orchestrator = orchestrator

    def node_hydrate_context(self, state: dict) -> dict:
        draft = self._require_draft(state["draft_id"])
        profile = self._ensure_profile(draft.employee_id)
        sop = self._sop_extractor.extract(profile)
        self._log("workflow_context_hydrated", draft_id=draft.draft_id, employee_id=draft.employee_id)
        return {
            "draft": draft,
            "profile": profile,
            "sop": sop,
            "cached_skills": self._skill_cache.list_for_user(draft.employee_id),
        }

    def execute_analysis_node(self, state: dict, node: WorkflowNode) -> dict:
        self._log(
            "workflow_node_started",
            draft_id=state["draft"].draft_id,
            node_id=node.node_id,
            node_type=node.node_type,
        )
        analyses = dict(state.get("analyses", {}))
        messages = build_node_messages(
            profile=state["profile"],
            sop=state["sop"],
            topic=state["draft"].topic,
            role=node.node_type,
            team_roles=[item.node_type for item in state["draft"].nodes if item.enabled],
            cached_skills=state.get("cached_skills", []),
            selected_skill_name=node.skill_name,
            selected_sop_name=node.sop_name,
            node_params=node.params,
        )
        analyses[node.node_id] = self._llm.complete(messages=messages, model="deepseek-chat")
        self._log(
            "workflow_node_completed",
            draft_id=state["draft"].draft_id,
            node_id=node.node_id,
            node_type=node.node_type,
        )
        return {"analyses": analyses}

    def execute_synthesis_node(self, state: dict, node: WorkflowNode) -> dict:
        self._log(
            "workflow_node_started",
            draft_id=state["draft"].draft_id,
            node_id=node.node_id,
            node_type=node.node_type,
        )
        messages = build_discussion_messages(
            state["profile"],
            state["sop"],
            state["draft"].topic,
            [item.node_type for item in state["draft"].nodes if item.enabled],
            state["analyses"],
            state.get("cached_skills", []),
            selected_skill_name=node.skill_name,
            selected_sop_name=node.sop_name,
        )
        response = self._llm.complete(messages=messages, model="deepseek-chat")
        discussion = parse_discussion_response(response, state["draft"].topic)
        self._log(
            "workflow_node_completed",
            draft_id=state["draft"].draft_id,
            node_id=node.node_id,
            node_type=node.node_type,
            discussion_keys=list(discussion.keys()),
        )
        return {"discussion": discussion}

    def execute_notify_node(self, state: dict, node: WorkflowNode) -> dict:
        self._log(
            "workflow_node_completed",
            draft_id=state["draft"].draft_id,
            node_id=node.node_id,
            node_type=node.node_type,
            notification_status="pending",
        )
        return {"notification_status": "pending"}

    def _ensure_profile(self, employee_id: str):
        profile = self._profile_repository.get_by_id(employee_id)
        if profile is None:
            self._log("employee_profile_bootstrap_started", employee_id=employee_id)
            profile = self._profile_repository.bootstrap(employee_id)
            self._log("employee_profile_bootstrap_completed", employee_id=employee_id)
        return profile

    def _resolve_roles(self, profile, topic: str) -> list[str]:
        roles = recommend_roles(profile)
        normalized_topic = topic.lower()
        if any(word in normalized_topic for word in ["policy", "approval", "regulation", "compliance", "reimbursement"]):
            roles = list(dict.fromkeys([*roles, "policy_monitoring", "risk_control"]))
        if any(word in normalized_topic for word in ["financial", "valuation", "revenue", "profit", "cashflow"]):
            roles = list(dict.fromkeys([*roles, "financial_analysis"]))
        if any(word in normalized_topic for word in ["data", "market", "patient", "clinical", "trial"]):
            roles = list(dict.fromkeys([*roles, "data_analysis"]))
        return roles

    def _require_draft(self, draft_id: str) -> WorkflowDraft:
        draft = self._workflow_repository.get_by_id(draft_id)
        if draft is None:
            raise ValueError(f"Workflow draft not found: {draft_id}")
        return draft

    def _require_node(self, draft: WorkflowDraft, node_id: str) -> WorkflowNode:
        for node in draft.nodes:
            if node.node_id == node_id:
                return node
        raise ValueError(f"Workflow node not found: {node_id}")

    def _transition_for_edit(self, draft: WorkflowDraft) -> None:
        if draft.status in {"draft", "editing", "ready", "failed"}:
            draft.status = "editing"
            return
        if can_transition(draft.status, "editing"):
            draft.status = "editing"
            return
        raise ValueError(f"Draft cannot be edited from state: {draft.status}")

    def _validate_draft(self, draft: WorkflowDraft) -> None:
        enabled_nodes = [node for node in draft.nodes if node.enabled]
        if not enabled_nodes:
            raise ValueError("Workflow draft must contain at least one enabled node")
        node_ids = {node.node_id for node in draft.nodes}
        for node in draft.nodes:
            for dependency in node.depends_on:
                if dependency not in node_ids:
                    raise ValueError(f"Node dependency missing: {dependency}")

    def _resolve_selected_skills(
        self, employee_id: str, selected_skill_names: list[str]
    ) -> list[SkillDefinition]:
        if not selected_skill_names:
            return []
        indexed = {
            skill.name: skill for skill in self._skill_cache.list_for_user(employee_id)
        }
        missing = [name for name in selected_skill_names if name not in indexed]
        if missing:
            raise ValueError(f"Selected skills not found: {', '.join(missing)}")
        return [indexed[name] for name in selected_skill_names]

    def _resolve_team_member_profiles(self, employee_id: str, selected_team_members: list[str]) -> list:
        profiles = []
        seen = set()
        for member_id in selected_team_members:
            if not member_id or member_id == employee_id or member_id in seen:
                continue
            profile = self._profile_repository.get_by_id(member_id)
            if profile is None:
                raise ValueError(f"Team member not found: {member_id}")
            profiles.append(profile)
            seen.add(member_id)
        return profiles

    def _build_team_member_nodes(self, team_profiles: list) -> list[WorkflowNode]:
        nodes: list[WorkflowNode] = []
        for member in team_profiles:
            member_skills = self._skill_cache.list_for_user(member.employee_id)
            nodes.append(
                WorkflowNode(
                    node_id=str(uuid.uuid4()),
                    node_type="team_collaboration",
                    title=f"{member.name} Collaboration",
                    params={
                        "employee_id": member.employee_id,
                        "member_name": member.name,
                        "member_title": member.title,
                        "department": member.department,
                        "focus_areas": member.focus_areas,
                        "tags": member.tags,
                        "skill_names": [skill.name for skill in member_skills],
                    },
                )
            )
        return nodes

    def _plan_graph(
        self,
        *,
        profile,
        team_profiles: list,
        topic: str,
        initiator_skills: list[SkillDefinition],
        team_skill_map: dict[str, list[SkillDefinition]],
        selected_skills: list[SkillDefinition],
    ) -> list[WorkflowNode]:
        messages = build_graph_plan_messages(
            profile=profile,
            team_profiles=team_profiles,
            topic=topic,
            initiator_skills=initiator_skills,
            team_skill_map=team_skill_map,
        )
        try:
            response = self._complete_with_timeout(messages=messages, model="deepseek-chat", timeout_seconds=8.0)
            planned = parse_graph_plan_response(response)
            nodes = self._materialize_planned_nodes(
                planned.get("nodes", []),
                profile=profile,
                team_profiles=team_profiles,
                selected_skills=selected_skills,
                team_skill_map=team_skill_map,
            )
            if nodes:
                self._log("workflow_graph_planned_by_llm", employee_id=profile.employee_id, node_count=len(nodes))
                return nodes
        except Exception as exc:
            self._log("workflow_graph_planner_failed", employee_id=profile.employee_id, error=str(exc))

        roles = self._resolve_roles(profile, topic)
        for member in team_profiles:
            roles = list(dict.fromkeys([*roles, *self._resolve_roles(member, topic)]))
        base_nodes = self._base_workflow_builder.build(roles)
        nodes = self._workflow_composer.compose(
            base_nodes,
            [self._build_skill_extension(skill) for skill in selected_skills],
        )
        collaboration_nodes = self._build_team_member_nodes(team_profiles)
        if collaboration_nodes:
            synth_node = next((node for node in nodes if node.node_type == "synthesize"), None)
            if synth_node:
                synth_node.depends_on = list(dict.fromkeys([*synth_node.depends_on, *[node.node_id for node in collaboration_nodes]]))
            notify_node = next((node for node in nodes if node.node_type == "notify"), None)
            if notify_node and synth_node:
                notify_node.depends_on = [synth_node.node_id]
            nodes.extend(collaboration_nodes)
        return self._apply_default_layout(nodes)

    def _complete_with_timeout(self, *, messages: list[dict[str, str]], model: str, timeout_seconds: float) -> str:
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = executor.submit(self._llm.complete, messages=messages, model=model)
        try:
            return future.result(timeout=timeout_seconds)
        except concurrent.futures.TimeoutError as exc:
            future.cancel()
            executor.shutdown(wait=False, cancel_futures=True)
            raise TimeoutError(f"LLM planning timed out after {timeout_seconds}s") from exc
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    def _materialize_planned_nodes(
        self,
        planned_nodes: list[dict],
        *,
        profile,
        team_profiles: list,
        selected_skills: list[SkillDefinition],
        team_skill_map: dict[str, list[SkillDefinition]],
    ) -> list[WorkflowNode]:
        if not planned_nodes:
            return []
        valid_node_types = {
            "data_analysis",
            "competitive_tracking",
            "policy_monitoring",
            "financial_analysis",
            "risk_control",
            "team_collaboration",
            "synthesize",
            "notify",
        }
        materialized: list[WorkflowNode] = []
        type_to_ids: dict[str, list[str]] = {}
        available_skill_names = {
            skill.name for skill in selected_skills
        } | {skill.name for skill in self._skill_cache.list_for_user(profile.employee_id)}
        for skills in team_skill_map.values():
            available_skill_names.update(skill.name for skill in skills)

        for item in planned_nodes:
            node_type = item["node_type"] if item["node_type"] in valid_node_types else "data_analysis"
            node_id = str(uuid.uuid4())
            params = dict(item.get("params") or {})
            owner_id = item.get("owner_employee_id")
            if owner_id:
                params["owner_employee_id"] = owner_id
            if item.get("owner_name"):
                params["owner_name"] = item.get("owner_name")
            skill_name = item.get("skill_name") if item.get("skill_name") in available_skill_names else None
            node = WorkflowNode(
                node_id=node_id,
                node_type=node_type,
                title=item.get("title") or node_type.replace("_", " ").title(),
                skill_name=skill_name,
                sop_name=item.get("sop_name"),
                params=params,
            )
            materialized.append(node)
            type_to_ids.setdefault(node_type, []).append(node_id)

        for index, item in enumerate(planned_nodes):
            depends_on: list[str] = []
            for dependency_type in item.get("depends_on_types", []):
                depends_on.extend(type_to_ids.get(dependency_type, []))
            materialized[index].depends_on = list(dict.fromkeys(depends_on))

        has_synthesize = any(node.node_type == "synthesize" for node in materialized)
        has_notify = any(node.node_type == "notify" for node in materialized)
        if not has_synthesize:
            synth_id = str(uuid.uuid4())
            materialized.append(
                WorkflowNode(
                    node_id=synth_id,
                    node_type="synthesize",
                    title="Synthesize Discussion",
                    depends_on=[node.node_id for node in materialized if node.node_type != "notify"],
                )
            )
            type_to_ids.setdefault("synthesize", []).append(synth_id)
        if not has_notify:
            materialized.append(
                WorkflowNode(
                    node_id=str(uuid.uuid4()),
                    node_type="notify",
                    title="Notify Stakeholders",
                    depends_on=list(type_to_ids.get("synthesize", [])),
                )
            )
        return self._apply_default_layout(materialized)

    def _apply_default_layout(self, nodes: list[WorkflowNode]) -> list[WorkflowNode]:
        level_map: dict[str, int] = {}
        node_map = {node.node_id: node for node in nodes}

        def resolve_level(node: WorkflowNode) -> int:
            if node.node_id in level_map:
                return level_map[node.node_id]
            if not node.depends_on:
                level_map[node.node_id] = 0
                return 0
            level = max(resolve_level(node_map[dependency]) for dependency in node.depends_on if dependency in node_map) + 1
            level_map[node.node_id] = level
            return level

        for node in nodes:
            resolve_level(node)
        grouped: dict[int, list[WorkflowNode]] = {}
        for node in nodes:
            grouped.setdefault(level_map[node.node_id], []).append(node)
        for level, grouped_nodes in grouped.items():
            total_width = len(grouped_nodes) * 260 + max(0, len(grouped_nodes) - 1) * 80
            start_x = max(60, int(560 - total_width / 2))
            for index, node in enumerate(grouped_nodes):
                node.params = {
                    **node.params,
                    "ui": {"x": start_x + index * 340, "y": 72 + level * 190},
                }
        return nodes

    def _build_skill_extension(self, skill: SkillDefinition) -> SkillExtension:
        metadata = skill.metadata or {}
        merge_mode = metadata.get("merge_mode", "parallel")
        blueprints = metadata.get("node_blueprints", [])
        if not blueprints:
            blueprints = [
                {
                    "node_type": skill.name,
                    "title": skill.name.replace("_", " ").title(),
                    "merge_mode": merge_mode,
                    "depends_on_types": [],
                    "sop_name": metadata.get("default_sop"),
                    "params": metadata,
                }
            ]
        return SkillExtension(
            skill_name=skill.name,
            merge_mode=merge_mode,
            nodes=[
                SkillNodeBlueprint(
                    node_type=item["node_type"],
                    title=item.get("title", item["node_type"].replace("_", " ").title()),
                    merge_mode=item.get("merge_mode", merge_mode),
                    depends_on_types=item.get("depends_on_types", []),
                    sop_name=item.get("sop_name"),
                    params=item.get("params", {}),
                )
                for item in blueprints
            ],
        )

    def _log(self, event: str, **fields) -> None:
        if self._logger:
            self._logger.log(event, **fields)
