"""Memory recall tool — vector + structured hybrid search over MemoryNode."""

from __future__ import annotations

import json
import logging
import math
import os
import time
from typing import Any

import psycopg

from base.embedding import get_embedding_provider
from base.tools.schema import tool

logger = logging.getLogger("memory_tools")

_DB_URL: str | None = None


def _get_db_url() -> str:
    global _DB_URL
    if _DB_URL is None:
        url = os.environ.get(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/pharma_alpha",
        )
        if "?schema=" in url:
            url = url[: url.index("?schema=")]
        _DB_URL = url
    return _DB_URL


def _decay_score(last_access_ts: float, now: float, half_life_days: float = 30.0) -> float:
    """Exponential decay: score halves every `half_life_days`."""
    age_days = (now - last_access_ts) / 86400.0
    return math.exp(-0.693 * age_days / half_life_days)


@tool(description="从用户记忆中检索与查询最相关的历史信息（实体、结论、偏好等）")
def memory_recall(query: str, top_k: int = 5) -> str:
    """query: 自然语言查询; top_k: 返回条数(默认5)"""
    user_id = os.environ.get("MEMORY_USER_ID", "")
    if not user_id:
        return "[]"

    provider = get_embedding_provider()
    query_vec = provider.embed_single(query)

    now = time.time()
    results: list[dict[str, Any]] = []

    try:
        with psycopg.connect(_get_db_url()) as conn:
            if query_vec is not None:
                vec_str = f"[{','.join(str(v) for v in query_vec)}]"
                rows = conn.execute(
                    """
                    SELECT id, category, subject, predicate, object, confidence,
                           "accessCount", "lastAccessAt",
                           1 - (embedding <=> %s::vector) AS similarity
                    FROM "MemoryNode"
                    WHERE "userId" = %s AND embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (vec_str, user_id, vec_str, top_k * 2),
                ).fetchall()
            else:
                rows = _fallback_text_search(conn, user_id, query, top_k * 2)

            for row in rows:
                node_id, category, subject, predicate, obj, confidence, access_count, last_access, similarity = (
                    row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8] if query_vec else 0.5
                )

                last_ts = last_access.timestamp() if hasattr(last_access, "timestamp") else now
                decay = _decay_score(last_ts, now)
                freq_score = min(access_count / 20.0, 1.0)

                final_score = similarity * 0.6 + freq_score * 0.2 + decay * 0.2

                results.append({
                    "id": node_id,
                    "category": category,
                    "subject": subject,
                    "predicate": predicate or "",
                    "object": obj,
                    "confidence": confidence,
                    "score": round(final_score, 4),
                })

            results.sort(key=lambda x: x["score"], reverse=True)
            results = results[:top_k]

            if results:
                ids = [r["id"] for r in results]
                placeholders = ",".join(["%s"] * len(ids))
                conn.execute(
                    f"""UPDATE "MemoryNode"
                        SET "accessCount" = "accessCount" + 1,
                            "lastAccessAt" = NOW()
                        WHERE id IN ({placeholders})""",
                    ids,
                )
                conn.commit()

    except Exception as e:
        logger.error("memory_recall failed: %s", e)
        return "[]"

    if query_vec is not None:
        try:
            with psycopg.connect(_get_db_url()) as conn:
                vec_str = f"[{','.join(str(v) for v in query_vec)}]"
                summary_rows = conn.execute(
                    """
                    SELECT summary, topics,
                           1 - (embedding <=> %s::vector) AS similarity
                    FROM "ConversationSummary"
                    WHERE "userId" = %s AND embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector
                    LIMIT 2
                    """,
                    (vec_str, user_id, vec_str),
                ).fetchall()
                for row in summary_rows:
                    if row[2] > 0.5:
                        results.append({
                            "id": "summary",
                            "category": "history",
                            "subject": "历史对话",
                            "predicate": "",
                            "object": row[0][:200],
                            "confidence": 1.0,
                            "score": round(row[2] * 0.5, 4),
                        })
        except Exception as e:
            logger.warning("ConversationSummary search failed: %s", e)

    results.sort(key=lambda x: x["score"], reverse=True)
    results = results[:top_k]

    if not results:
        return "[]"

    lines = []
    for r in results:
        pred_part = f" ({r['predicate']})" if r["predicate"] else ""
        lines.append(f"- [{r['category']}] {r['subject']}{pred_part}: {r['object']}")

    return "\n".join(lines)


def _fallback_text_search(
    conn: psycopg.Connection, user_id: str, query: str, limit: int
) -> list[tuple]:
    """Fallback: ILIKE search on subject when embedding is unavailable."""
    keywords = [w for w in query.split() if len(w) >= 2]
    if not keywords:
        keywords = [query[:10]]

    conditions = " OR ".join(
        [f"subject ILIKE '%' || {psycopg.sql.Literal(k).as_string(conn)} || '%'" for k in keywords[:3]]
    )

    return conn.execute(
        f"""
        SELECT id, category, subject, predicate, object, confidence,
               "accessCount", "lastAccessAt", 0.5::float AS similarity
        FROM "MemoryNode"
        WHERE "userId" = %s AND ({conditions})
        ORDER BY "lastAccessAt" DESC
        LIMIT %s
        """,
        (user_id, limit),
    ).fetchall()
