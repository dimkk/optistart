from __future__ import annotations

import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from .base import AgentRunner, RunnerBootstrap


class RunnerManager:
    def __init__(self, home_dir: Path, runner: AgentRunner) -> None:
        self.home_dir = home_dir
        self.runner = runner

    def bootstrap(self, project: str) -> RunnerBootstrap:
        info = RunnerBootstrap(
            project=project,
            runner=self.runner.name,
            bootstrapped_at=datetime.now(UTC).isoformat(),
        )
        session_dir = self.home_dir / "sessions" / project
        session_dir.mkdir(parents=True, exist_ok=True)
        (session_dir / "runner.json").write_text(
            json.dumps(asdict(info), indent=2),
            encoding="utf-8",
        )
        return info
