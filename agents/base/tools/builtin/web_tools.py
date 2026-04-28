"""Web search and page fetching tools.

Search backends, in order of preference:
  1. Tavily Search API (if TAVILY_API_KEY is set) — purpose-built for LLMs,
     auto-ranks by relevance and returns clean snippets.
  2. Bing HTML scrape with mkt=zh-CN, freshness filter, and a UGC-site
     blocklist so 知乎/小红书/抖音 stop polluting Chinese-finance results.

The two surface tools differ by intent:
  - `search_web`  → general-purpose lookup (no freshness by default)
  - `search_news` → time-sensitive news (default last 7 days, news topic)
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from base.tools.schema import tool

MAX_CONTENT_LENGTH = 30_000
REQUEST_TIMEOUT = 15
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Domains that pollute Chinese-finance / news searches.
# These are mostly UGC / Q&A / SEO sites that rank high but provide
# little factual signal for analytic queries.
_DOMAIN_BLOCKLIST = {
    # UGC / Q&A
    "zhihu.com",
    "xiaohongshu.com",
    "douyin.com",
    "weibo.com",
    "tieba.baidu.com",
    "zhidao.baidu.com",
    "wenku.baidu.com",
    "jingyan.baidu.com",
    # Encyclopedia (low signal for "why / how / 原因分析" queries)
    "baike.baidu.com",
    "wiki.mbalib.com",
    # Tech blogs / video / aggregator noise
    "csdn.net",
    "cnblogs.com",
    "bilibili.com",
    "youku.com",
    "iqiyi.com",
    "kuaishou.com",
}

# Bing freshness mapping (qft= filter).
_BING_FRESHNESS = {
    "day": "+filterui:age-lt1d",
    "week": "+filterui:age-lt7d",
    "month": "+filterui:age-lt1m",
    "year": "+filterui:age-lt1y",
}

# Words that auto-trigger a 7-day freshness filter on `search_web`
# when the LLM forgets to set freshness explicitly.
_FRESHNESS_HINT_WORDS = (
    "最新", "今日", "今天", "昨天", "本周", "上周",
    "本月", "近期", "最近", "刚刚", "刚才",
    "latest", "today", "recent", "this week",
)


def _build_request(url: str) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "identity",
        },
    )


def _fetch_html(url: str) -> str:
    req = _build_request(url)
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def _domain_is_blocked(url: str) -> bool:
    if not url:
        return True
    host = urllib.parse.urlparse(url).netloc.lower()
    if not host:
        return True
    return any(host == d or host.endswith("." + d) or d in host for d in _DOMAIN_BLOCKLIST)


def _strip_html(html: str, extract_main: bool = False) -> str:
    """Minimal HTML → text extraction without external dependencies."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            tag.decompose()
        if extract_main:
            main = soup.find("main") or soup.find("article") or soup.find(class_=re.compile(r"(content|article|main)", re.I))
            if main:
                return main.get_text(separator="\n", strip=True)
        return soup.get_text(separator="\n", strip=True)
    except ImportError:
        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.S | re.I)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.S | re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        return re.sub(r"\s+", " ", text).strip()


def _detect_implicit_freshness(query: str) -> str | None:
    q = query.lower()
    return "week" if any(w in q for w in _FRESHNESS_HINT_WORDS) else None


def _format_results(items: list[dict[str, str]]) -> str:
    """Render search hits as Markdown for the LLM."""
    if not items:
        return ""
    blocks = []
    for i, it in enumerate(items, 1):
        title = (it.get("title") or "").strip() or "(no title)"
        url = (it.get("url") or "").strip()
        snippet = (it.get("snippet") or "").strip()
        date = (it.get("date") or "").strip()
        date_part = f" · {date}" if date else ""
        blocks.append(f"{i}. **{title}**{date_part}\n   {url}\n   {snippet}")
    return "\n\n".join(blocks)


# ── Backend: Tavily ────────────────────────────────────────


def _search_via_tavily(
    query: str,
    num_results: int,
    topic: str = "general",
    days: int | None = None,
) -> list[dict[str, str]] | None:
    """Tavily Search API. Returns None when not configured."""
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return None

    payload: dict[str, Any] = {
        "api_key": api_key,
        "query": query,
        "max_results": max(num_results, 5),
        "search_depth": "basic",
        "topic": topic,
    }
    if days and days > 0:
        payload["days"] = days

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.tavily.com/search",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        # Fail soft — caller will fall back to Bing.
        return [{"_error": f"tavily failed: {e}"}]

    results = data.get("results") or []
    items: list[dict[str, str]] = []
    for r in results:
        url = r.get("url") or ""
        if _domain_is_blocked(url):
            continue
        items.append({
            "title": r.get("title") or "",
            "url": url,
            "snippet": r.get("content") or "",
            "date": r.get("published_date") or "",
        })
        if len(items) >= num_results:
            break
    return items


# ── Backend: Bing HTML ─────────────────────────────────────


def _search_via_bing(
    query: str,
    num_results: int,
    freshness: str | None = None,
) -> list[dict[str, str]]:
    encoded_q = urllib.parse.quote_plus(query)
    parts = [
        f"https://www.bing.com/search?q={encoded_q}",
        # Pull a wider candidate pool because we filter UGC out.
        f"count={num_results * 3}",
        "mkt=zh-CN",
        "setlang=zh-CN",
    ]
    if freshness and freshness in _BING_FRESHNESS:
        parts.append(f"qft={urllib.parse.quote(_BING_FRESHNESS[freshness])}")
    search_url = "&".join([parts[0]] + parts[1:]).replace("?&", "?", 1)

    html = _fetch_html(search_url)
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        raise RuntimeError("beautifulsoup4 required: pip install beautifulsoup4")

    soup = BeautifulSoup(html, "html.parser")
    items: list[dict[str, str]] = []
    for li in soup.select("li.b_algo"):
        title_el = li.select_one("h2 a")
        snippet_el = li.select_one(".b_caption p") or li.select_one(".b_caption")
        if not title_el:
            continue
        href = title_el.get("href", "") or ""
        if _domain_is_blocked(href):
            continue
        title = title_el.get_text(strip=True)
        snippet = snippet_el.get_text(strip=True) if snippet_el else ""
        # Bing often prepends a date like "2026-04-25 · ..." to the snippet.
        date = ""
        m = re.match(r"^(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d+\s*(?:天|小时|分钟)前)\s*[·\-]?\s*", snippet)
        if m:
            date = m.group(1)
            snippet = snippet[m.end():].strip()
        items.append({"title": title, "url": href, "snippet": snippet, "date": date})
        if len(items) >= num_results:
            break
    return items


# ── Tools ─────────────────────────────────────────────────


@tool(description=(
    "通用网页搜索。适合：背景知识、概念解释、长尾信息。"
    "时效性强的查询请用 search_news。优先使用 Tavily（若配置了 TAVILY_API_KEY），"
    "否则回退到 Bing 中文区，自动过滤 UGC 站点（知乎/小红书/抖音/百度知道等）。"
))
def search_web(query: str, num_results: int = 5, freshness: str = "auto") -> str:
    """query: 搜索关键词；num_results: 返回结果数量；
    freshness: 'auto'(根据查询自动判断) | 'day' | 'week' | 'month' | 'year' | 'none'
    """
    num = max(1, min(num_results, 10))
    fresh: str | None = None
    if freshness == "auto":
        fresh = _detect_implicit_freshness(query)
    elif freshness in _BING_FRESHNESS:
        fresh = freshness
    elif freshness != "none":
        fresh = None

    days_map = {"day": 1, "week": 7, "month": 30, "year": 365}
    items = _search_via_tavily(query, num, topic="general", days=days_map.get(fresh or ""))
    if items and items[0].get("_error"):
        items = None

    if items is None:
        try:
            items = _search_via_bing(query, num, freshness=fresh)
        except Exception as e:
            return f"[Search Error] 搜索失败: {e}"

    if not items:
        hint = "提示：尝试更具体的关键词，或换用 search_news（用于新闻）/ search_research_reports（研报）/ rag_search（已入库知识）。"
        return f"搜索 '{query}' 未找到有效结果。\n{hint}"

    formatted = _format_results(items)
    backend = "Tavily" if os.environ.get("TAVILY_API_KEY") else "Bing"
    fresh_note = f" · freshness={fresh}" if fresh else ""
    return f"[{backend}{fresh_note}] 搜索 '{query}' 找到 {len(items)} 条结果：\n\n{formatted}"


@tool(description=(
    "新闻 / 财经评论搜索。适合：行情解读、政策影响、突发事件。"
    "默认抓取最近 7 天，自动按发布时间排序。优先使用 Tavily news topic，"
    "否则回退 Bing 资讯类查询。"
))
def search_news(query: str, num_results: int = 5, freshness: str = "week") -> str:
    """query: 搜索关键词；num_results: 返回结果数量；
    freshness: 'day' | 'week'(默认) | 'month'
    """
    num = max(1, min(num_results, 10))
    fresh = freshness if freshness in {"day", "week", "month"} else "week"
    days_map = {"day": 1, "week": 7, "month": 30}

    items = _search_via_tavily(query, num, topic="news", days=days_map[fresh])
    if items and items[0].get("_error"):
        items = None

    if items is None:
        # Bing news fallback: append a soft news intent so we bias toward articles.
        try:
            items = _search_via_bing(query, num, freshness=fresh)
        except Exception as e:
            return f"[News Error] 搜索失败: {e}"

    if not items:
        return (
            f"搜索新闻 '{query}' 未找到有效结果。提示：换用更具体的关键词，"
            f"或调用 search_research_reports（研报）。"
        )

    formatted = _format_results(items)
    backend = "Tavily" if os.environ.get("TAVILY_API_KEY") else "Bing"
    return f"[{backend} news · last {fresh}] '{query}' 找到 {len(items)} 条：\n\n{formatted}"


@tool(description="抓取网页内容并提取文本")
def fetch_webpage(url: str, extract: str = "full") -> str:
    """url: 目标网页URL; extract: 提取模式('full'=全文, 'main'=仅正文)"""
    try:
        html = _fetch_html(url)
        text = _strip_html(html, extract_main=(extract == "main"))
        if len(text) > MAX_CONTENT_LENGTH:
            text = text[:MAX_CONTENT_LENGTH] + "\n\n[已截断，原文过长]"
        if not text.strip():
            return f"[Fetch] 页面 {url} 未提取到有效文本内容"
        return text
    except urllib.error.HTTPError as e:
        return f"[Fetch Error] HTTP {e.code}: {url}"
    except urllib.error.URLError as e:
        return f"[Fetch Error] 无法连接: {url} ({e.reason})"
    except Exception as e:
        return f"[Fetch Error] 抓取失败: {e}"
