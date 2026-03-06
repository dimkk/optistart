from __future__ import annotations

from .base import AgentRunner
from .claude import ClaudeRunner
from .codex import CodexRunner


def create_runner(runner_name: str) -> AgentRunner:
    if runner_name == "codex":
        return CodexRunner()
    if runner_name == "claude":
        return ClaudeRunner()
    raise ValueError(f"unsupported runner: {runner_name}")
