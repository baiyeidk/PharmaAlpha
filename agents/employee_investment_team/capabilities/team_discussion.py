from __future__ import annotations

import json


ROLE_OUTPUTS = {
    "data_analysis": "Data analysis suggests validating market size, growth quality, and signal consistency.",
    "financial_analysis": "Financial analysis focuses on revenue resilience, R&D efficiency, and cash runway.",
    "policy_monitoring": "Policy monitoring highlights reimbursement, approval, and compliance sensitivity.",
    "risk_control": "Risk control stresses downside triggers, evidence gaps, and stop-loss conditions.",
    "competitive_tracking": "Competitive tracking compares pipeline overlap and approval timing with peers.",
}


def build_node_messages(
    profile,
    sop,
    topic: str,
    role: str,
    team_roles: list[str],
    cached_skills: list[dict],
    selected_skill_name: str | None = None,
    selected_sop_name: str | None = None,
    node_params: dict | None = None,
) -> list[dict[str, str]]:
    skill_summaries = [f"{item.name}: {item.description}" for item in cached_skills]
    system_prompt = (
        f"You are the {role} node in a pharmaceutical investment workflow. "
        "Return concise analytical prose with evidence-oriented recommendations."
    )
    user_prompt = (
        f"Employee: {profile.name}\n"
        f"Title: {profile.title}\n"
        f"Decision Style: {sop.decision_style}\n"
        f"Topic: {topic}\n"
        f"Team Roles: {', '.join(team_roles)}\n"
        f"Role Guidance: {ROLE_OUTPUTS.get(role, role)}\n"
        f"Selected Skill: {selected_skill_name or 'none'}\n"
        f"Selected SOP: {selected_sop_name or 'none'}\n"
        f"Node Params: {json.dumps(node_params or {}, ensure_ascii=False)}\n"
        f"Cached Skills: {' | '.join(skill_summaries) if skill_summaries else 'none'}"
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def build_discussion_messages(
    profile,
    sop,
    topic: str,
    roles: list[str],
    analyses: dict[str, str],
    cached_skills: list[dict],
    selected_skill_name: str | None = None,
    selected_sop_name: str | None = None,
) -> list[dict[str, str]]:
    role_descriptions = [ROLE_OUTPUTS[role] for role in roles if role in ROLE_OUTPUTS]
    skill_summaries = [f"{item.name}: {item.description}" for item in cached_skills]
    system_prompt = (
        "You are an investment discussion orchestrator for a pharmaceutical research team. "
        "Return strict JSON with keys: summary, consensus, disagreements, actions. "
        "Each list item must be concise and action-oriented."
    )
    user_prompt = (
        f"Employee: {profile.name}\n"
        f"Title: {profile.title}\n"
        f"Department: {profile.department}\n"
        f"Focus Areas: {', '.join(profile.focus_areas)}\n"
        f"Tags: {', '.join(profile.tags)}\n"
        f"Decision Style: {sop.decision_style}\n"
        f"SOP Steps: {' | '.join(sop.steps)}\n"
        f"Risk Checks: {' | '.join(sop.risk_checks)}\n"
        f"Discussion Topic: {topic}\n"
        f"Team Roles: {', '.join(roles)}\n"
        f"Role Guidance: {' | '.join(role_descriptions)}\n"
        f"Synthesis Skill: {selected_skill_name or 'none'}\n"
        f"Synthesis SOP: {selected_sop_name or 'none'}\n"
        f"Cached Skills: {' | '.join(skill_summaries) if skill_summaries else 'none'}\n"
        f"Node Analyses: {json.dumps(analyses, ensure_ascii=False)}"
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def parse_discussion_response(content: str, topic: str) -> dict:
    summary = (
        f"Team reviewed '{topic}' and recommends a staged decision with explicit evidence checks."
    )
    fallback = {
        "summary": summary,
        "consensus": ["Validate the thesis with evidence from finance, policy, and market data."],
        "disagreements": ["Upside and policy risk need further balancing before action."],
        "actions": [
            f"Run a focused review on topic: {topic}",
            "Collect supporting evidence for each major claim before final recommendation.",
        ],
    }
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return fallback

    return {
        "summary": parsed.get("summary") or fallback["summary"],
        "consensus": parsed.get("consensus") or fallback["consensus"],
        "disagreements": parsed.get("disagreements") or fallback["disagreements"],
        "actions": parsed.get("actions") or fallback["actions"],
    }
