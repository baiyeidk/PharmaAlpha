"""Document parsers for RAG pipeline: PDF, web, and plain text."""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("rag_parser")


@dataclass
class ParsedDocument:
    title: str
    content: str
    source_type: str  # "pdf" | "web" | "manual"
    source_url: str | None = None
    file_hash: str | None = None
    pages: list[PageContent] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class PageContent:
    text: str
    page_number: int
    metadata: dict[str, Any] = field(default_factory=dict)


def parse_pdf(file_path: str) -> ParsedDocument:
    """Parse a PDF file using pdfplumber, preserving page boundaries."""
    import pdfplumber

    pages: list[PageContent] = []
    all_text_parts: list[str] = []
    file_hash = _compute_file_hash(file_path)

    with pdfplumber.open(file_path) as pdf:
        title = ""
        if pdf.metadata and pdf.metadata.get("Title"):
            title = pdf.metadata["Title"]

        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(PageContent(text=text, page_number=i + 1))
                all_text_parts.append(text)

        if not title and all_text_parts:
            first_line = all_text_parts[0].split("\n")[0].strip()
            title = first_line[:100] if first_line else "Untitled PDF"

    return ParsedDocument(
        title=title or "Untitled PDF",
        content="\n\n".join(all_text_parts),
        source_type="pdf",
        file_hash=file_hash,
        pages=pages,
    )


def parse_webpage(url: str) -> ParsedDocument:
    """Fetch and parse a webpage, extracting main content."""
    import requests
    from bs4 import BeautifulSoup

    resp = requests.get(url, timeout=30, headers={
        "User-Agent": "Mozilla/5.0 (compatible; PharmaAlpha/1.0)"
    })
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding or "utf-8"

    soup = BeautifulSoup(resp.text, "html.parser")

    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "iframe"]):
        tag.decompose()

    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()

    article = soup.find("article") or soup.find("main") or soup.find("body")
    text = article.get_text(separator="\n") if article else soup.get_text(separator="\n")

    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    content_hash = hashlib.sha256(text.encode()).hexdigest()

    return ParsedDocument(
        title=title or url[:100],
        content=text,
        source_type="web",
        source_url=url,
        file_hash=content_hash,
    )


def parse_text(text: str, title: str = "Untitled") -> ParsedDocument:
    """Wrap plain text as a ParsedDocument."""
    content_hash = hashlib.sha256(text.encode()).hexdigest()
    return ParsedDocument(
        title=title,
        content=text,
        source_type="manual",
        file_hash=content_hash,
    )


def _compute_file_hash(file_path: str) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for block in iter(lambda: f.read(8192), b""):
            h.update(block)
    return h.hexdigest()
