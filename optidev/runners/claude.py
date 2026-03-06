from __future__ import annotations

from .base import AgentRunner


class ClaudeRunner(AgentRunner):
    name = "claude"

    def run(self, task: str) -> str:
        return f"claude:run:{task}"

    def resume(self, session_id: str) -> str:
        return f"claude:resume:{session_id}"

    def stop(self) -> str:
        return "claude:stop"
