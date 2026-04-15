"""RAG tools — document search and ingestion for PEC Agent."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import psycopg

from base.embedding import get_embedding_provider
from base.tools.schema import tool

logger = logging.getLogger("rag_tools")


def _get_db_url() -> str:
    url = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/pharma_alpha",
    )
    if "?schema=" in url:
        url = url[: url.index("?schema=")]
    return url


@tool(description="在知识库中检索与查询最相关的文档片段（研报、财报、公告等）")
def rag_search(query: str, top_k: int = 5, doc_type: str = "") -> str:
    """query: 自然语言查询; top_k: 返回条数(默认5); doc_type: 可选文档类型过滤(pdf/web/manual)"""
    provider = get_embedding_provider()
    query_vec = provider.embed_single(query)

    if query_vec is None:
        return json.dumps([], ensure_ascii=False)

    vec_str = f"[{','.join(str(v) for v in query_vec)}]"

    try:
        with psycopg.connect(_get_db_url()) as conn:
            if doc_type:
                rows = conn.execute(
                    """
                    SELECT dc.content, dc.metadata,
                           1 - (dc.embedding <=> %s::vector) AS score,
                           d.title, d."sourceType"
                    FROM "DocumentChunk" dc
                    JOIN "Document" d ON dc."documentId" = d.id
                    WHERE dc.embedding IS NOT NULL
                      AND d.status = 'ready'
                      AND d."sourceType" = %s
                    ORDER BY dc.embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (vec_str, doc_type, vec_str, top_k),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT dc.content, dc.metadata,
                           1 - (dc.embedding <=> %s::vector) AS score,
                           d.title, d."sourceType"
                    FROM "DocumentChunk" dc
                    JOIN "Document" d ON dc."documentId" = d.id
                    WHERE dc.embedding IS NOT NULL
                      AND d.status = 'ready'
                    ORDER BY dc.embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (vec_str, vec_str, top_k),
                ).fetchall()

        results = []
        for row in rows:
            content, chunk_meta, score, doc_title, source_type = row
            meta = chunk_meta if isinstance(chunk_meta, dict) else {}
            results.append({
                "content": content[:1000],
                "score": round(float(score), 4),
                "metadata": {
                    "page": meta.get("page"),
                    "sourceUrl": meta.get("sourceUrl"),
                    "docTitle": doc_title,
                    "docType": source_type,
                },
            })

        if not results:
            return "知识库中未找到相关文档。"

        lines = []
        for r in results:
            meta = r["metadata"]
            src = f" (来源: {meta['docTitle']}"
            if meta.get("page"):
                src += f", 第{meta['page']}页"
            src += ")"
            lines.append(f"[相似度: {r['score']}]{src}\n{r['content'][:500]}")

        return "\n\n---\n\n".join(lines)

    except Exception as e:
        logger.error("rag_search failed: %s", e)
        return f"文档检索出错: {e}"


@tool(description="将一个网页URL或文件摄入到知识库中，供后续检索使用")
def rag_ingest(url: str = "", file_path: str = "") -> str:
    """url: 网页URL; file_path: 本地PDF文件路径。二选一。"""
    if not url and not file_path:
        return "请提供 url 或 file_path 参数"

    try:
        from base.rag.ingest import ingest_document

        user_id = os.environ.get("MEMORY_USER_ID")
        result = ingest_document(
            file_path=file_path if file_path else None,
            url=url if url else None,
            user_id=user_id,
        )
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        logger.error("rag_ingest failed: %s", e)
        return f"文档摄入失败: {e}"
