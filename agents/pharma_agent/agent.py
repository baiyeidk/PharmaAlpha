"""
PharmaAlpha Demo Agent - Pharmaceutical Assistant.

This is a demonstration agent that simulates drug information queries
and interaction analysis. Replace with actual LLM API calls for production.
"""

from __future__ import annotations

import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base import BaseAgent
from base.protocol import AgentRequest, AgentChunk, AgentResult, AgentError


DRUG_DATABASE = {
    "aspirin": {
        "name": "Aspirin (Acetylsalicylic acid)",
        "class": "NSAID / Antiplatelet",
        "indications": "Pain relief, fever reduction, anti-inflammatory, cardiovascular prevention",
        "dosage": "325-650mg every 4-6 hours (analgesic), 75-100mg daily (cardiovascular)",
        "side_effects": "GI bleeding, tinnitus, Reye's syndrome (children)",
    },
    "metformin": {
        "name": "Metformin",
        "class": "Biguanide",
        "indications": "Type 2 Diabetes Mellitus",
        "dosage": "500-2000mg daily in divided doses",
        "side_effects": "GI upset, lactic acidosis (rare), B12 deficiency",
    },
    "lisinopril": {
        "name": "Lisinopril",
        "class": "ACE Inhibitor",
        "indications": "Hypertension, Heart failure, Post-MI",
        "dosage": "10-40mg once daily",
        "side_effects": "Dry cough, hyperkalemia, angioedema",
    },
}


class PharmaAgent(BaseAgent):
    def execute(self, request: AgentRequest):
        messages = request.messages
        if not messages:
            yield AgentError(content="No messages provided")
            return

        user_msg = messages[-1].get("content", "").lower()

        yield AgentChunk(content="Analyzing your query...\n\n")
        time.sleep(0.3)

        found_drug = None
        for drug_key in DRUG_DATABASE:
            if drug_key in user_msg:
                found_drug = DRUG_DATABASE[drug_key]
                break

        if found_drug:
            yield AgentChunk(content=f"**{found_drug['name']}**\n\n")
            time.sleep(0.2)
            yield AgentChunk(content=f"**Class:** {found_drug['class']}\n")
            time.sleep(0.1)
            yield AgentChunk(content=f"**Indications:** {found_drug['indications']}\n")
            time.sleep(0.1)
            yield AgentChunk(content=f"**Dosage:** {found_drug['dosage']}\n")
            time.sleep(0.1)
            yield AgentChunk(content=f"**Side Effects:** {found_drug['side_effects']}\n\n")
            time.sleep(0.1)

            yield AgentResult(
                content="Please consult a healthcare professional for personalized medical advice.",
                metadata={"drug": found_drug["name"], "source": "demo_database"},
            )
        else:
            chunks = [
                "I'm the PharmaAlpha assistant. ",
                "I can help you with pharmaceutical information.\n\n",
                "Try asking about:\n",
                "- **Aspirin** - pain relief and cardiovascular prevention\n",
                "- **Metformin** - diabetes management\n",
                "- **Lisinopril** - blood pressure control\n\n",
            ]
            for chunk in chunks:
                yield AgentChunk(content=chunk)
                time.sleep(0.15)

            yield AgentResult(
                content="What drug would you like to know about?",
                metadata={"type": "greeting"},
            )


if __name__ == "__main__":
    PharmaAgent().run()
