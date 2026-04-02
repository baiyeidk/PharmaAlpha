"""
PharmaAlpha Demo Agent - Pharmaceutical Investment Assistant.

This agent demonstrates the tool_call protocol. Canvas tools are
automatically injected via system message — the agent just needs to
output tool_call JSON lines and the server handles execution.

When the underlying LLM is switched to Claude/GPT/etc., the tools
still work because they're defined in the system prompt, not in agent code.
"""

from __future__ import annotations

import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base import BaseAgent
from base.protocol import AgentRequest, AgentChunk, AgentToolCall, AgentResult, AgentError


DRUG_DATABASE = {
    "aspirin": {
        "name": "Aspirin (阿司匹林)",
        "class": "NSAID / 抗血小板药",
        "indications": "镇痛、退热、抗炎、心血管预防",
        "dosage": "325-650mg 每 4-6 小时 (镇痛), 75-100mg 每天 (心血管)",
        "side_effects": "胃肠道出血、耳鸣、Reye综合征(儿童)",
    },
    "metformin": {
        "name": "Metformin (二甲双胍)",
        "class": "双胍类",
        "indications": "2 型糖尿病",
        "dosage": "500-2000mg/天 分次服用",
        "side_effects": "胃肠不适、乳酸酸中毒(罕见)、B12 缺乏",
    },
}

STOCK_MAP = {
    "恒瑞医药": "600276",
    "药明康德": "603259",
    "迈瑞医疗": "300760",
    "片仔癀": "600436",
    "复星医药": "600196",
    "百济神州": "688235",
    "华兰生物": "002007",
    "智飞生物": "300122",
}


class PharmaAgent(BaseAgent):
    """Demo agent that uses canvas tools via the standard tool_call protocol."""

    def execute(self, request: AgentRequest):
        messages = request.messages
        if not messages:
            yield AgentError(content="No messages provided")
            return

        user_msg = messages[-1].get("content", "").lower()

        yield AgentChunk(content="正在分析...\n\n")
        time.sleep(0.3)

        # Drug query
        found_drug = None
        for drug_key in DRUG_DATABASE:
            if drug_key in user_msg:
                found_drug = DRUG_DATABASE[drug_key]
                break

        if found_drug:
            yield AgentChunk(content=f"**{found_drug['name']}**\n\n")
            yield AgentChunk(content=f"**分类:** {found_drug['class']}\n")
            yield AgentChunk(content=f"**适应症:** {found_drug['indications']}\n")
            yield AgentChunk(content=f"**用量:** {found_drug['dosage']}\n")
            yield AgentChunk(content=f"**副作用:** {found_drug['side_effects']}\n\n")

            yield AgentResult(
                content="请咨询专业医疗人员获取个性化医疗建议。",
            )
            return

        # Stock analysis — emit tool_call via protocol, server auto-executes
        found_stocks = []
        for name, code in STOCK_MAP.items():
            if name in user_msg or code in user_msg:
                found_stocks.append((name, code))

        if found_stocks:
            for name, code in found_stocks:
                yield AgentChunk(content=f"📊 **{name}** ({code})\n")
                yield AgentToolCall.canvas_add_chart(
                    label=f"{name} 走势",
                    tickers=[code],
                    description=f"{name}({code}) 近期走势分析",
                )

            summary = "、".join(f"{n}({c})" for n, c in found_stocks)
            yield AgentToolCall.canvas_add_text(
                label="分析摘要",
                content=f"关注标的: {summary}\n分析要点: 需关注营收增速、研发管线、政策影响等因素。",
                description="AI 生成的分析摘要",
            )

            yield AgentResult(
                content=f"\n已将 {summary} 的走势图和分析摘要添加到画布。",
            )
            return

        # Default greeting
        yield AgentChunk(content="我是 PharmaAlpha 智能投资助手。\n\n")
        yield AgentChunk(content="**试试问我:**\n")
        yield AgentChunk(content="- 分析**恒瑞医药**的投资价值\n")
        yield AgentChunk(content="- **药明康德**最近走势\n")
        yield AgentChunk(content="- 查询 **Aspirin** 药物信息\n\n")

        yield AgentResult(content="有什么想了解的医药投资信息？")


if __name__ == "__main__":
    PharmaAgent().run()
