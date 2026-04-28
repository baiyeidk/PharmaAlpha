"""Built-in tools for PharmaAlpha agents."""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..registry import ToolRegistry


def register_canvas_tools(registry: ToolRegistry) -> None:
    from .canvas_tools import (
        canvas_add_chart, canvas_add_text, canvas_add_image,
        canvas_remove_node, canvas_update_node,
    )
    for fn in (canvas_add_chart, canvas_add_text, canvas_add_image,
               canvas_remove_node, canvas_update_node):
        registry.register(fn)


def register_stock_tools(registry: ToolRegistry) -> None:
    from .stock_tools import get_stock_quote, get_stock_kline
    for fn in (get_stock_quote, get_stock_kline):
        registry.register(fn)


def register_pdf_tools(registry: ToolRegistry) -> None:
    from .pdf_tools import read_uploaded_pdf
    registry.register(read_uploaded_pdf)


def register_web_tools(registry: ToolRegistry) -> None:
    from .web_tools import search_web, search_news, fetch_webpage
    for fn in (search_web, search_news, fetch_webpage):
        registry.register(fn)


def register_financial_tools(registry: ToolRegistry) -> None:
    from .financial_tools import fetch_financial_report
    registry.register(fetch_financial_report)


def register_memory_tools(registry: ToolRegistry) -> None:
    from .memory_tools import memory_recall
    registry.register(memory_recall)


def register_rag_tools(registry: ToolRegistry) -> None:
    from .rag_tools import rag_search, rag_ingest
    for fn in (rag_search, rag_ingest):
        registry.register(fn)


def register_report_tools(registry: ToolRegistry) -> None:
    from .report_fetcher import (
        search_financial_reports, search_research_reports,
        download_report_to_rag,
    )
    for fn in (search_financial_reports, search_research_reports,
               download_report_to_rag):
        registry.register(fn)


def register_all_tools(registry: ToolRegistry) -> None:
    """Register every built-in tool."""
    register_canvas_tools(registry)
    register_stock_tools(registry)
    register_pdf_tools(registry)
    register_web_tools(registry)
    register_financial_tools(registry)
    register_memory_tools(registry)
    register_rag_tools(registry)
    register_report_tools(registry)
