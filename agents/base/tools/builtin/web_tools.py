"""Web search and page fetching tools."""

from __future__ import annotations

import re
import urllib.request
import urllib.error
import urllib.parse
from typing import Any

from base.tools.schema import tool

MAX_CONTENT_LENGTH = 30_000
REQUEST_TIMEOUT = 15
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


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
                text = main.get_text(separator="\n", strip=True)
                return text
        return soup.get_text(separator="\n", strip=True)
    except ImportError:
        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.S | re.I)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.S | re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text


@tool(description="搜索网页，获取与查询相关的网页结果列表")
def search_web(query: str, num_results: int = 5) -> str:
    """query: 搜索关键词; num_results: 返回结果数量"""
    encoded_q = urllib.parse.quote_plus(query)
    search_url = f"https://www.bing.com/search?q={encoded_q}&count={num_results}"
    try:
        html = _fetch_html(search_url)
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            results = []
            for item in soup.select("li.b_algo")[:num_results]:
                title_el = item.select_one("h2 a")
                snippet_el = item.select_one(".b_caption p")
                if title_el:
                    title = title_el.get_text(strip=True)
                    href = title_el.get("href", "")
                    snippet = snippet_el.get_text(strip=True) if snippet_el else ""
                    results.append(f"**{title}**\n  URL: {href}\n  {snippet}")
            if results:
                return "\n\n".join(results)
            return f"搜索 '{query}' 未找到明确结果，请尝试调整关键词。"
        except ImportError:
            return f"搜索 '{query}' 完成，但需要 beautifulsoup4 来解析结果。请安装: pip install beautifulsoup4"
    except Exception as e:
        return f"[Search Error] 搜索失败: {e}"


@tool(description="抓取网页内容并提取文本")
def fetch_webpage(url: str, extract: str = "full") -> str:
    """url: 目标网页URL; extract: 提取模式('full'=全文, 'main'=仅正文)"""
    try:
        html = _fetch_html(url)
        text = _strip_html(html, extract_main=(extract == "main"))
        if len(text) > MAX_CONTENT_LENGTH:
            text = text[:MAX_CONTENT_LENGTH] + f"\n\n[已截断，原文过长]"
        if not text.strip():
            return f"[Fetch] 页面 {url} 未提取到有效文本内容"
        return text
    except urllib.error.HTTPError as e:
        return f"[Fetch Error] HTTP {e.code}: {url}"
    except urllib.error.URLError as e:
        return f"[Fetch Error] 无法连接: {url} ({e.reason})"
    except Exception as e:
        return f"[Fetch Error] 抓取失败: {e}"
