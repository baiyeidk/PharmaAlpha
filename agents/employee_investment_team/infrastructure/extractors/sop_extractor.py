from __future__ import annotations

from employee_investment_team.domain.ports.sop_extractor_port import SOPExtractorPort
from employee_investment_team.domain.value_objects.sop import SOP


class SimpleSOPExtractor(SOPExtractorPort):
    def extract(self, profile):
        steps = [
            "Review employee observation notes and historical investment behaviors.",
            "Pull role-aligned data, financial, and policy viewpoints.",
            "Summarize consensus, disagreements, and next actions.",
        ]
        risk_checks = [
            "Validate data provenance for key claims.",
            "Highlight policy and compliance changes affecting the target.",
            "Document unresolved assumptions before recommendation.",
        ]
        return SOP(steps=steps, risk_checks=risk_checks, decision_style="multi-perspective")
