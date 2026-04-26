"""Stock market data tools — query quotes and K-line via platform API."""

from __future__ import annotations

from base.platform_api import PlatformAPIClient
from base.tools.schema import tool

_client: PlatformAPIClient | None = None


def _get_client() -> PlatformAPIClient:
    global _client
    if _client is None:
        _client = PlatformAPIClient()
    return _client


def _to_float(value: object) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _is_quote_row_valid(row: dict) -> bool:
    code = str(row.get("code") or "").strip()
    price = _to_float(row.get("price"))
    name = str(row.get("name") or "").strip()
    # Treat missing code/name or non-positive price as invalid quote payload.
    return bool(code and name and price is not None and price > 0)


@tool(description="查询A股股票实时行情（价格、涨跌幅、成交量等）")
def get_stock_quote(codes: str) -> str:
    """codes: 逗号分隔的A股代码，如'600276,300760'"""
    try:
        data = _get_client().get("/stocks/quote", params={"codes": codes})
        if not data:
            return f"[Stock API Error] 未找到股票 {codes} 的行情数据"
        valid_rows = [q for q in data if isinstance(q, dict) and _is_quote_row_valid(q)]
        if not valid_rows:
            return f"[Stock API Error] 股票 {codes} 行情数据为空或异常（可能接口返回无效数据）"
        lines = []
        for q in valid_rows:
            lines.append(
                f"【{q.get('name', q.get('code', '?'))}】 "
                f"代码: {q.get('code')} | "
                f"价格: {q.get('price')} | "
                f"涨跌幅: {q.get('changePercent', 'N/A')}% | "
                f"成交量: {q.get('volume', 'N/A')} | "
                f"成交额: {q.get('amount', 'N/A')}"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"[Stock API Error] 查询行情失败: {e}"


@tool(description="查询A股股票K线历史数据（开高低收成交量）")
def get_stock_kline(code: str, period: str = "daily", days: int = 30) -> str:
    """code: A股代码如'600276'; period: 周期(daily/weekly/monthly); days: 天数"""
    try:
        data = _get_client().get(
            "/stocks/kline",
            params={"code": code, "period": period, "days": str(days)},
        )
        if not data:
            return f"[Stock API Error] 未找到股票 {code} 的K线数据"
        valid_bars = [bar for bar in data if isinstance(bar, dict) and bar.get("date")]
        if not valid_bars:
            return f"[Stock API Error] 股票 {code} 的K线数据为空或格式异常"
        lines = [f"股票 {code} 近{days}个{period}K线:"]
        lines.append("日期 | 开盘 | 收盘 | 最高 | 最低 | 涨跌幅 | 成交量")
        lines.append("--- | --- | --- | --- | --- | --- | ---")
        for bar in valid_bars[-10:]:
            lines.append(
                f"{bar.get('date', '?')} | "
                f"{bar.get('open', '?')} | "
                f"{bar.get('close', '?')} | "
                f"{bar.get('high', '?')} | "
                f"{bar.get('low', '?')} | "
                f"{bar.get('changePercent', '?')}% | "
                f"{bar.get('volume', '?')}"
            )
        if len(valid_bars) > 10:
            lines.append(f"... (共{len(valid_bars)}条，仅显示最近10条)")
        return "\n".join(lines)
    except Exception as e:
        return f"[Stock API Error] 查询K线失败: {e}"
