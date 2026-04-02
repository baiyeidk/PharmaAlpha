from __future__ import annotations


ALLOWED_TRANSITIONS = {
    "draft": {"editing", "ready", "cancelled"},
    "editing": {"ready", "cancelled"},
    "ready": {"editing", "confirmed", "cancelled"},
    "confirmed": {"running", "cancelled"},
    "running": {"paused", "completed", "failed", "cancelled"},
    "paused": {"confirmed", "cancelled"},
    "completed": set(),
    "failed": {"editing", "cancelled"},
    "cancelled": set(),
}


def can_transition(current: str, target: str) -> bool:
    return target in ALLOWED_TRANSITIONS.get(current, set())


def require_transition(current: str, target: str) -> None:
    if not can_transition(current, target):
        raise ValueError(f"Invalid workflow transition: {current} -> {target}")
