from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RunnerBootstrap:
    project: str
    runner: str
    bootstrapped_at: str


class AgentRunner:
    name = "unknown"

    def run(self, task: str) -> str:
        raise NotImplementedError

    def resume(self, session_id: str) -> str:
        raise NotImplementedError

    def stop(self) -> str:
        raise NotImplementedError
