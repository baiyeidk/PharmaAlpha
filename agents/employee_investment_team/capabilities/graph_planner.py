from __future__ import annotations

import json


def build_graph_plan_messages(
    *,
    profile,
    team_profiles: list,
    topic: str,
    initiator_skills: list,
    team_skill_map: dict[str, list],
) -> list[dict[str, str]]:
    team_descriptions = []
    for member in team_profiles:
        skills = team_skill_map.get(member.employee_id, [])
        team_descriptions.append(
            {
                "employee_id": member.employee_id,
                "name": member.name,
                "title": member.title,
                "department": member.department,
                "focus_areas": member.focus_areas,
                "tags": member.tags,
                "skills": [
                    {
                        "name": skill.name,
                        "description": skill.description,
                        "metadata": skill.metadata,
                    }
                    for skill in skills
                ],
            }
        )

    system_prompt = (
        "You are a workflow planning model for a pharmaceutical investment studio. "
        "Generate a strict JSON object with keys: nodes, rationale. "
        "nodes must be an array of objects containing: node_type, title, depends_on_types, "
        "skill_name, sop_name, owner_employee_id, owner_name, params. "
        "Build a directed acyclic graph from top to bottom. "
        "Always include a final synthesize node and a notify node after synthesize. "
        "Prefer 5 to 9 nodes. Use team_collaboration nodes when a teammate should review the topic. "
        "Do not return markdown."
    )
    user_prompt = json.dumps(
        {
            "topic": topic,
            "initiator": {
                "employee_id": profile.employee_id,
                "name": profile.name,
                "title": profile.title,
                "department": profile.department,
                "focus_areas": profile.focus_areas,
                "tags": profile.tags,
                "skills": [
                    {
                        "name": skill.name,
                        "description": skill.description,
                        "metadata": skill.metadata,
                    }
                    for skill in initiator_skills
                ],
            },
            "team_members": team_descriptions,
            "rules": [
                "Node graph must stay acyclic",
                "Start with evidence gathering or specialty review nodes",
                "Combine initiator and selected team member skills when relevant",
                "Use skill_name only when a node clearly maps to an available skill",
                "owner_employee_id should be the employee best suited for that node",
            ],
        },
        ensure_ascii=False,
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def parse_graph_plan_response(content: str) -> dict[str, list | str]:
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return {"nodes": [], "rationale": "fallback"}

    nodes = parsed.get("nodes")
    if not isinstance(nodes, list):
        nodes = []

    sanitized = []
    for item in nodes:
        if not isinstance(item, dict):
            continue
        sanitized.append(
            {
                "node_type": item.get("node_type") or "data_analysis",
                "title": item.get("title") or "Workflow Node",
                "depends_on_types": item.get("depends_on_types") or [],
                "skill_name": item.get("skill_name"),
                "sop_name": item.get("sop_name"),
                "owner_employee_id": item.get("owner_employee_id"),
                "owner_name": item.get("owner_name"),
                "params": item.get("params") or {},
            }
        )

    return {
        "nodes": sanitized,
        "rationale": parsed.get("rationale") or "planned",
    }
