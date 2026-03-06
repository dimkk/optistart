from __future__ import annotations

from typing import Protocol


class Plugin(Protocol):
    def on_workspace_start(self, context: dict[str, str]) -> None:
        ...

    def on_agent_message(self, message: str) -> None:
        ...

    def on_workspace_stop(self, context: dict[str, str]) -> None:
        ...
