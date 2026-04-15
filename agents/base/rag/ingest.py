"""Document ingestion pipeline: parse -> chunk -> embed -> store."""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import psycopg

from base.embedding import get_embedding_provider, BATCH_LIMIT
from base.rag.chunker import recursive_chunk
from base.rag.parser import parse_pdf, parse_webpage, parse_text, ParsedDocument

logger = logging.getLogger("rag_ingest")

INGEST_TIMEOUT = 120


def _get_db_url() -> str:
    url = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/pharma_alpha",
    )
    if "?schema=" in url:
        url = url[: url.index("?schema=")]
    return url


def ingest_document(
    *,
    file_path: str | None = None,
    url: str | None = None,
    text: str | None = None,
    title: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Main ingestion entry point. Returns { document_id, chunk_count, status }.
    Raises on fatal errors; partial embedding failures are tolerated.
    """
    start = time.time()

    if file_path:
        doc = parse_pdf(file_path)
    elif url:
        doc = parse_webpage(url)
    elif text:
        doc = parse_text(text, title=title or "Untitled")
    else:
        raise ValueError("One of file_path, url, or text is required")

    if title:
        doc.title = title

    with psycopg.connect(_get_db_url()) as conn:
        if doc.file_hash:
            existing = conn.execute(
                'SELECT id, status FROM "Document" WHERE "fileHash" = %s',
                (doc.file_hash,),
            ).fetchone()
            if existing:
                return {
                    "document_id": existing[0],
                    "status": existing[1],
                    "chunk_count": 0,
                    "message": "Document already exists",
                }

        conn.execute(
            """INSERT INTO "Document" (id, "userId", title, "sourceType", "sourceUrl", "fileHash", status, "chunkCount", metadata, "createdAt", "updatedAt")
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, 'processing', 0, %s, NOW(), NOW())""",
            (user_id, doc.title, doc.source_type, doc.source_url, doc.file_hash, "{}"),
        )
        conn.commit()

        row = conn.execute(
            'SELECT id FROM "Document" WHERE "fileHash" = %s',
            (doc.file_hash,),
        ).fetchone()
        if not row:
            raise RuntimeError("Failed to retrieve created document")
        doc_id = row[0]

    try:
        chunks = _chunk_document(doc)
        _embed_and_store_chunks(doc_id, chunks)

        elapsed = time.time() - start
        if elapsed > INGEST_TIMEOUT:
            _update_doc_status(doc_id, "error", len(chunks), {"error": "timeout"})
            return {"document_id": doc_id, "status": "error", "chunk_count": len(chunks)}

        _update_doc_status(doc_id, "ready", len(chunks))
        logger.info("Ingested document %s: %d chunks in %.1fs", doc_id, len(chunks), elapsed)

        return {"document_id": doc_id, "status": "ready", "chunk_count": len(chunks)}

    except Exception as e:
        logger.error("Ingestion failed for %s: %s", doc_id, e)
        _update_doc_status(doc_id, "error", 0, {"error": str(e)})
        raise


def _chunk_document(doc: ParsedDocument) -> list[dict[str, Any]]:
    """Chunk document with page-level metadata."""
    if doc.pages:
        all_chunks = []
        for page in doc.pages:
            meta = {"page": page.page_number, "docType": doc.source_type}
            if doc.source_url:
                meta["sourceUrl"] = doc.source_url
            page_chunks = recursive_chunk(page.text, metadata=meta)
            all_chunks.extend(page_chunks)
        for i, c in enumerate(all_chunks):
            c.index = i
        return [{"content": c.content, "index": c.index, "metadata": c.metadata} for c in all_chunks]
    else:
        meta = {"docType": doc.source_type}
        if doc.source_url:
            meta["sourceUrl"] = doc.source_url
        chunks = recursive_chunk(doc.content, metadata=meta)
        return [{"content": c.content, "index": c.index, "metadata": c.metadata} for c in chunks]


def _embed_and_store_chunks(doc_id: str, chunks: list[dict[str, Any]]) -> None:
    """Batch-embed chunks and write to DocumentChunk table."""
    provider = get_embedding_provider()
    texts = [c["content"] for c in chunks]

    all_embeddings: list[list[float] | None] = []
    for i in range(0, len(texts), BATCH_LIMIT):
        batch = texts[i : i + BATCH_LIMIT]
        batch_embeddings = provider.embed(batch)
        all_embeddings.extend(batch_embeddings)

    with psycopg.connect(_get_db_url()) as conn:
        for i, chunk in enumerate(chunks):
            vec = all_embeddings[i] if i < len(all_embeddings) else None
            import json
            meta_json = json.dumps(chunk["metadata"], ensure_ascii=False)

            if vec:
                vec_str = f"[{','.join(str(v) for v in vec)}]"
                conn.execute(
                    """INSERT INTO "DocumentChunk" (id, "documentId", content, metadata, "chunkIndex", embedding, "createdAt")
                       VALUES (gen_random_uuid()::text, %s, %s, %s::jsonb, %s, %s::vector, NOW())""",
                    (doc_id, chunk["content"], meta_json, chunk["index"], vec_str),
                )
            else:
                conn.execute(
                    """INSERT INTO "DocumentChunk" (id, "documentId", content, metadata, "chunkIndex", "createdAt")
                       VALUES (gen_random_uuid()::text, %s, %s, %s::jsonb, %s, NOW())""",
                    (doc_id, chunk["content"], meta_json, chunk["index"]),
                )
        conn.commit()


def _update_doc_status(
    doc_id: str, status: str, chunk_count: int, metadata: dict | None = None
) -> None:
    import json
    with psycopg.connect(_get_db_url()) as conn:
        if metadata:
            conn.execute(
                """UPDATE "Document" SET status = %s, "chunkCount" = %s, metadata = %s::jsonb, "updatedAt" = NOW() WHERE id = %s""",
                (status, chunk_count, json.dumps(metadata), doc_id),
            )
        else:
            conn.execute(
                """UPDATE "Document" SET status = %s, "chunkCount" = %s, "updatedAt" = NOW() WHERE id = %s""",
                (status, chunk_count, doc_id),
            )
        conn.commit()
