from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class MuxSession:
    backend: str
    session_name: str
    layout_path: Path


class Multiplexer(Protocol):
    """Terminal multiplexer contract for workspace operations."""

    backend_name: str

    def start_session(self, project: str, session_dir: Path) -> MuxSession:
        ...

    def stop_session(self, session_name: str) -> None:
        ...
