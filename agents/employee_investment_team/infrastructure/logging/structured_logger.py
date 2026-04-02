from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


class StructuredLogger:
    def __init__(self, log_file: str | None = None) -> None:
        base_dir = Path(__file__).resolve().parents[2]
        self._log_file = Path(log_file) if log_file else base_dir / ".logs" / "agent.ndjson"
        self._log_file.parent.mkdir(parents=True, exist_ok=True)

    def log(self, event: str, **fields) -> None:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "event": event,
            **fields,
        }
        with self._log_file.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
