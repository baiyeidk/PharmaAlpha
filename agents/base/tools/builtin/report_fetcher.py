"""Financial report & research report fetcher.

Searches and downloads reports from:
- Shanghai Stock Exchange (SSE) — annual/semi/quarterly reports
- Shenzhen Stock Exchange (SZSE) — annual/semi/quarterly reports
- EastMoney — industry & individual stock research reports

Downloaded PDFs are auto-ingested into the RAG knowledge base.
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import time
import urllib.request
import urllib.error
import urllib.parse
from typing import Any

from base.tools.schema import tool

logger = logging.getLogger("report_fetcher")

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_TIMEOUT = 20


def _http_get(url: str, headers: dict[str, str] | None = None) -> bytes:
    hdrs = {"User-Agent": _UA, **(headers or {})}
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return resp.read()


def _http_get_json(url: str, headers: dict[str, str] | None = None) -> Any:
    data = _http_get(url, headers)
    return json.loads(data.decode("utf-8", errors="replace"))


# ── SSE (上海交易所) ──────────────────────────────────────────

def _sse_search(stock_code: str, report_type: str = "annual", limit: int = 5) -> list[dict]:
    """Search SSE disclosure announcements."""
    category_map = {
        "annual": "NDBG",
        "semi": "BNDBG",
        "quarterly": "JDBG",
        "all": "",
    }
    category = category_map.get(report_type, "")

    api_url = (
        f"http://query.sse.com.cn/security/stock/queryCompanyBulletin.do"
        f"?jsonCallBack=jsonpCallback&isPagination=true&productId={stock_code}"
        f"&keyWord=&securityType=0101&reportType2={category}"
        f"&reportType=ALL&beginDate=&endDate="
        f"&pageHelp.pageSize={limit}&pageHelp.pageNo=1&pageHelp.beginPage=1"
    )

    headers = {
        "Referer": "http://www.sse.com.cn/",
        "Host": "query.sse.com.cn",
    }

    try:
        raw = _http_get(api_url, headers).decode("utf-8", errors="replace")
        json_str = re.search(r"jsonpCallback\((.*)\)", raw)
        if not json_str:
            return []
        data = json.loads(json_str.group(1))
        results = []
        for item in data.get("result", []):
            title = item.get("TITLE", "")
            url = item.get("URL", "")
            date = item.get("SSEDATE", "")
            if url and not url.startswith("http"):
                url = f"http://static.sse.com.cn{url}"
            results.append({"title": title, "url": url, "date": date, "source": "SSE"})
        return results
    except Exception as e:
        logger.warning("SSE search failed: %s", e)
        return []


# ── SZSE (深圳交易所) ─────────────────────────────────────────

def _szse_search(stock_code: str, report_type: str = "annual", limit: int = 5) -> list[dict]:
    """Search SZSE disclosure announcements."""
    category_map = {
        "annual": "category_ndbg_szsh",
        "semi": "category_bndbg_szsh",
        "quarterly": "category_jibao_szsh",
        "all": "",
    }
    category = category_map.get(report_type, "")

    api_url = "https://www.szse.cn/api/disc/announcement/annList"
    params = {
        "random": str(time.time()),
        "stock[]": stock_code,
        "channelCode": "fixed_disc",
        "pageSize": str(limit),
        "pageNum": "1",
    }
    if category:
        params["category[]"] = category

    query_str = urllib.parse.urlencode(params, doseq=True)
    full_url = f"{api_url}?{query_str}"

    try:
        data = _http_get_json(full_url, {"Referer": "https://www.szse.cn/"})
        results = []
        for item in data.get("data", []):
            title = item.get("title", "")
            attach_path = item.get("attachPath", "")
            date = item.get("publishTime", "")[:10]
            url = f"https://disc.szse.cn/download{attach_path}" if attach_path else ""
            results.append({"title": title, "url": url, "date": date, "source": "SZSE"})
        return results
    except Exception as e:
        logger.warning("SZSE search failed: %s", e)
        return []


# ── EastMoney (东方财富研报) ──────────────────────────────────

def _eastmoney_stock_reports(stock_code: str, limit: int = 5) -> list[dict]:
    """Search individual stock research reports on EastMoney."""
    api_url = (
        f"https://reportapi.eastmoney.com/report/list"
        f"?industryCode=*&pageSize={limit}&industry=*&rating=*"
        f"&ratingChange=*&beginTime=&endTime=&pageNo=1"
        f"&fields=&qType=0&orgCode=&rcode=&code={stock_code}"
    )

    try:
        data = _http_get_json(api_url)
        results = []
        for item in data.get("data", []):
            title = item.get("title", "")
            info_code = item.get("infoCode", "")
            date = item.get("publishDate", "")[:10]
            org = item.get("orgSName", "")
            pdf_url = f"https://pdf.dfcfw.com/pdf/H3_{info_code}_1.pdf" if info_code else ""
            results.append({
                "title": f"[{org}] {title}",
                "url": pdf_url,
                "date": date,
                "source": "EastMoney",
            })
        return results
    except Exception as e:
        logger.warning("EastMoney stock report search failed: %s", e)
        return []


def _eastmoney_industry_reports(industry: str, limit: int = 5) -> list[dict]:
    """Search industry research reports on EastMoney."""
    encoded = urllib.parse.quote(industry)
    api_url = (
        f"https://reportapi.eastmoney.com/report/list"
        f"?industryCode=*&pageSize={limit}&industry={encoded}&rating=*"
        f"&ratingChange=*&beginTime=&endTime=&pageNo=1"
        f"&fields=&qType=1&orgCode=&rcode=&code=*"
    )

    try:
        data = _http_get_json(api_url)
        results = []
        for item in data.get("data", []):
            title = item.get("title", "")
            info_code = item.get("infoCode", "")
            date = item.get("publishDate", "")[:10]
            org = item.get("orgSName", "")
            pdf_url = f"https://pdf.dfcfw.com/pdf/H3_{info_code}_1.pdf" if info_code else ""
            results.append({
                "title": f"[{org}] {title}",
                "url": pdf_url,
                "date": date,
                "source": "EastMoney",
            })
        return results
    except Exception as e:
        logger.warning("EastMoney industry report search failed: %s", e)
        return []


# ── PDF download + RAG ingest ─────────────────────────────────

def _download_and_ingest(url: str, title: str) -> dict[str, Any]:
    """Download a PDF and ingest it into the RAG knowledge base."""
    try:
        pdf_bytes = _http_get(url, headers={"Referer": url})

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes)
            tmp_path = f.name

        from base.rag.ingest import ingest_document
        result = ingest_document(
            file_path=tmp_path,
            title=title,
            user_id=os.environ.get("MEMORY_USER_ID"),
        )

        try:
            os.unlink(tmp_path)
        except OSError:
            pass

        return result
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ── Agent Tools ───────────────────────────────────────────────

@tool(description="搜索上市公司财报（年报/半年报/季报），数据来源：上交所、深交所")
def search_financial_reports(
    stock_code: str,
    report_type: str = "annual",
    limit: int = 5,
) -> str:
    """
    stock_code: A股代码如'600276'或'000661';
    report_type: 'annual'(年报),'semi'(半年报),'quarterly'(季报),'all'(全部);
    limit: 返回条数(默认5)
    """
    results = []

    if stock_code.startswith("6"):
        results.extend(_sse_search(stock_code, report_type, limit))
    elif stock_code.startswith(("0", "3")):
        results.extend(_szse_search(stock_code, report_type, limit))
    else:
        results.extend(_sse_search(stock_code, report_type, limit))
        results.extend(_szse_search(stock_code, report_type, limit))

    if not results:
        return f"[Report Error] 未找到 {stock_code} 的{report_type}财报，请确认代码正确。"

    lines = []
    for i, r in enumerate(results[:limit], 1):
        lines.append(
            f"{i}. [{r['source']}] {r['title']}\n"
            f"   日期: {r['date']}\n"
            f"   PDF: {r['url']}"
        )
    return "\n\n".join(lines)


@tool(description="搜索个股或行业研究报告，数据来源：东方财富")
def search_research_reports(
    query: str,
    query_type: str = "stock",
    limit: int = 5,
) -> str:
    """
    query: 股票代码(如'600276')或行业名称(如'医药');
    query_type: 'stock'(个股研报)或'industry'(行业研报);
    limit: 返回条数(默认5)
    """
    if query_type == "industry":
        results = _eastmoney_industry_reports(query, limit)
    else:
        results = _eastmoney_stock_reports(query, limit)

    if not results:
        return f"未找到与 '{query}' 相关的研报。"

    lines = []
    for i, r in enumerate(results[:limit], 1):
        lines.append(
            f"{i}. {r['title']}\n"
            f"   日期: {r['date']}\n"
            f"   PDF: {r['url']}"
        )
    return "\n\n".join(lines)


@tool(description="下载财报或研报PDF并导入知识库（RAG），供后续检索分析使用")
def download_report_to_rag(url: str, title: str = "") -> str:
    """
    url: 财报或研报的PDF下载链接;
    title: 文档标题（可选，自动推断）
    """
    if not url:
        return "请提供PDF的下载URL"

    if not title:
        parts = url.rsplit("/", 1)
        title = urllib.parse.unquote(parts[-1]) if len(parts) > 1 else "未命名报告"

    result = _download_and_ingest(url, title)

    if result.get("status") == "ready":
        return (
            f"报告已成功导入知识库！\n"
            f"- 标题: {title}\n"
            f"- 文档ID: {result.get('document_id', 'N/A')}\n"
            f"- 分块数: {result.get('chunk_count', 0)}\n"
            f"现在可以通过 rag_search 检索该报告内容。"
        )
    elif result.get("message") == "Document already exists":
        return f"该报告已存在于知识库中（ID: {result.get('document_id')}），无需重复导入。"
    else:
        return f"报告导入失败: {result.get('error', '未知错误')}"
