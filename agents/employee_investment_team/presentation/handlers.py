from __future__ import annotations

from dataclasses import asdict

from base.protocol import AgentChunk, AgentError, AgentResult


def handle_request(request, service, logger=None):
    params = request.params or {}
    employee_id = str(params.get("employee_id", "default"))
    action = request.action or "chat"
    topic = params.get("topic") or (request.messages[-1].get("content", "") if request.messages else "")
    if logger:
        logger.log("request_received", action=action, employee_id=employee_id, has_topic=bool(topic))

    try:
        if action == "register_skill":
            name = params.get("name")
            description = params.get("description")
            if not name or not description:
                yield AgentError(
                    content="Skill name and description are required",
                    code="MISSING_SKILL_FIELDS",
                )
                return
            skill = service.register_skill(employee_id, name, description, params.get("metadata"))
            if logger:
                logger.log("skill_registered", employee_id=employee_id, skill_name=skill.name)
            yield AgentResult(content=f"Registered skill {skill.name}.", metadata=asdict(skill))
            return

        if action == "list_skills":
            skills = [asdict(skill) for skill in service.list_skills(employee_id)]
            yield AgentResult(content=f"Listed {len(skills)} skills.", metadata={"skills": skills})
            return

        if action == "create_workflow":
            if not topic:
                yield AgentError(content="No workflow topic provided", code="MISSING_TOPIC")
                return
            draft = service.create_workflow_draft(
                employee_id,
                topic,
                params.get("selected_skills"),
                params.get("selected_team_members"),
            )
            if logger:
                logger.log("workflow_created", employee_id=employee_id, draft_id=draft.draft_id, status=draft.status)
            yield AgentResult(
                content=f"Created workflow draft {draft.draft_id}.",
                metadata=_serialize_draft(draft),
            )
            return

        if action == "list_workflows":
            drafts = [_serialize_draft(draft) for draft in service.list_workflow_drafts(employee_id)]
            yield AgentResult(content=f"Listed {len(drafts)} workflow drafts.", metadata={"drafts": drafts})
            return

        draft_id = params.get("draft_id")
        if action in {
            "add_node",
            "update_node",
            "delete_node",
            "mark_ready",
            "confirm_workflow",
            "execute_workflow",
        } and not draft_id:
            yield AgentError(content="draft_id is required", code="MISSING_DRAFT_ID")
            return

        if action == "add_node":
            draft = service.add_node(
                draft_id=draft_id,
                node_type=params.get("node_type"),
                title=params.get("title") or params.get("node_type", "Untitled Node"),
                depends_on=params.get("depends_on"),
                skill_name=params.get("skill_name"),
                sop_name=params.get("sop_name"),
                params=params.get("node_params"),
            )
            yield AgentResult(content=f"Added node to {draft_id}.", metadata=_serialize_draft(draft))
            return

        if action == "update_node":
            draft = service.update_node(
                draft_id=draft_id,
                node_id=params.get("node_id"),
                updates=params.get("updates", {}),
            )
            yield AgentResult(content=f"Updated node in {draft_id}.", metadata=_serialize_draft(draft))
            return

        if action == "delete_node":
            draft = service.delete_node(draft_id=draft_id, node_id=params.get("node_id"))
            yield AgentResult(content=f"Deleted node from {draft_id}.", metadata=_serialize_draft(draft))
            return

        if action == "mark_ready":
            draft = service.mark_ready(draft_id)
            yield AgentResult(content=f"Workflow {draft_id} is ready.", metadata=_serialize_draft(draft))
            return

        if action == "confirm_workflow":
            draft = service.confirm_workflow(draft_id)
            yield AgentResult(content=f"Workflow {draft_id} confirmed.", metadata=_serialize_draft(draft))
            return

        if action in {"chat", "execute_workflow"}:
            if action == "chat":
                if not topic:
                    yield AgentError(content="No workflow topic provided", code="MISSING_TOPIC")
                    return
                draft = service.create_workflow_draft(
                    employee_id,
                    topic,
                    params.get("selected_skills"),
                    params.get("selected_team_members"),
                )
                draft = service.confirm_workflow(draft.draft_id)
                draft_id = draft.draft_id
            yield AgentChunk(content="Executing confirmed workflow...\n")
            result = service.execute_workflow(draft_id)
            if logger:
                logger.log("workflow_completed", draft_id=result.draft_id, employee_id=result.employee_id)
            yield AgentResult(content=result.summary, metadata=asdict(result))
            return

        yield AgentError(content=f"Unsupported action: {action}", code="UNSUPPORTED_ACTION")
    except Exception as exc:
        if logger:
            logger.log("request_failed", action=action, employee_id=employee_id, error=str(exc))
        yield AgentError(content=str(exc), code="REQUEST_FAILED")


def _serialize_draft(draft):
    return {
        "draft_id": draft.draft_id,
        "employee_id": draft.employee_id,
        "topic": draft.topic,
        "status": draft.status,
        "selected_skills": draft.selected_skills,
        "team_members": draft.team_members,
        "nodes": [asdict(node) for node in draft.nodes],
    }
