"""Supervisor Agent entry point — PEC (Plan-Execute-Check) loop."""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supervisor_agent.pec_agent import PECAgent

if __name__ == "__main__":
    PECAgent().run()
