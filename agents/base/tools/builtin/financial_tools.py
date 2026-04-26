"""Financial report tools — fetch company fundamentals from public sources."""

from __future__ import annotations

import json
import re
import urllib.request
import urllib.error
from typing import Any

from base.tools.schema import tool

REQUEST_TIMEOUT = 15
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _fetch_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        # Some upstream endpoints occasionally prepend UTF-8 BOM.
        return json.loads(resp.read().decode("utf-8-sig", errors="replace"))


def _eastmoney_market_code(stock_code: str) -> str:
    """Determine East Money secid prefix: 1.xxx for SH, 0.xxx for SZ."""
    code = stock_code.strip()
    if code.startswith(("6", "9", "5")):
        return f"1.{code}"
    return f"0.{code}"


def _fetch_summary(stock_code: str) -> str:
    """Fetch key financial metrics from East Money F10 API."""
    secid = _eastmoney_market_code(stock_code)
    url = (
        f"https://push2.eastmoney.com/api/qt/stock/get?"
        f"secid={secid}&fields=f57,f58,f43,f44,f45,f46,f47,f48,f50,"
        f"f51,f52,f55,f116,f117,f162,f167,f168,f169,f170,f171,f173,"
        f"f177,f183,f184,f185,f186,f187,f188,f190,f191"
    )
    try:
        data = _fetch_json(url)
        d = data.get("data", {})
        if not d:
            return f"[Financial Error] 未找到股票 {stock_code} 的财务数据"

        def fmt(v: Any, divisor: int = 1) -> str:
            if v is None or v == "-":
                return "N/A"
            try:
                return f"{float(v) / divisor:,.2f}"
            except (ValueError, TypeError):
                return str(v)

        lines = [
            f"【{d.get('f58', stock_code)}({d.get('f57', stock_code)})】财务摘要",
            "",
            f"总市值: {fmt(d.get('f116'), 100_000_000)}亿 | 流通市值: {fmt(d.get('f117'), 100_000_000)}亿",
            f"市盈率(PE-TTM): {fmt(d.get('f162'))} | 市净率(PB): {fmt(d.get('f167'))}",
            f"每股收益(EPS): {fmt(d.get('f183'))} | 每股净资产(BPS): {fmt(d.get('f184'))}",
            f"净资产收益率(ROE): {fmt(d.get('f173'))}%",
            f"毛利率: {fmt(d.get('f186'))}% | 净利率: {fmt(d.get('f187'))}%",
            f"资产负债率: {fmt(d.get('f188'))}%",
        ]
        return "\n".join(lines)
    except Exception as e:
        return f"[Financial Error] 获取财务摘要失败: {e}"


def _fetch_income(stock_code: str) -> str:
    """Fetch income statement highlights from East Money."""
    code = stock_code.strip()
    if code.startswith(("6", "9", "5")):
        market = "SH"
    else:
        market = "SZ"

    url = (
        f"https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/"
        f"ZYZBAjaxAction?companyType=4&reportDateType=0&reportType=1&code={market}{code}"
    )
    try:
        data = _fetch_json(url)
        reports = data.get("data", [])
        if not reports:
            return f"[Financial Error] 未找到股票 {stock_code} 的利润表数据"

        lines = [f"【{stock_code}】利润表（最近报告期）", ""]
        lines.append("报告期 | 营业总收入 | 营业总成本 | 净利润 | 毛利率 | 净利率")
        lines.append("--- | --- | --- | --- | --- | ---")

        for r in reports[:4]:
            date = r.get("REPORT_DATE", "?")[:10]
            revenue = r.get("TOTAL_OPERATE_INCOME")
            cost = r.get("TOTAL_OPERATE_COST")
            net = r.get("NETPROFIT")

            def to_yi(v: Any) -> str:
                if v is None:
                    return "N/A"
                try:
                    return f"{float(v) / 100_000_000:.2f}亿"
                except (ValueError, TypeError):
                    return str(v)

            gross_margin = r.get("GROSS_PROFIT_RATIO")
            net_margin = r.get("NET_PROFIT_RATIO")
            gm = f"{float(gross_margin):.1f}%" if gross_margin else "N/A"
            nm = f"{float(net_margin):.1f}%" if net_margin else "N/A"

            lines.append(
                f"{date} | {to_yi(revenue)} | {to_yi(cost)} | {to_yi(net)} | {gm} | {nm}"
            )

        return "\n".join(lines)
    except Exception as e:
        return f"[Financial Error] 获取利润表失败: {e}"


@tool(description="获取上市公司财务数据（财务摘要或利润表）")
def fetch_financial_report(stock_code: str, report_type: str = "summary") -> str:
    """stock_code: A股代码如'600276'; report_type: 'summary'=财务摘要, 'income'=利润表"""
    if report_type == "income":
        return _fetch_income(stock_code)
    return _fetch_summary(stock_code)
