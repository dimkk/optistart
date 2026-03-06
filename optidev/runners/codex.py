from __future__ import annotations

from .base import AgentRunner


class CodexRunner(AgentRunner):
    name = "codex"

    def run(self, task: str) -> str:
        return f"codex:run:{task}"

    def resume(self, session_id: str) -> str:
        return f"codex:resume:{session_id}"

    def stop(self) -> str:
        return "codex:stop"
