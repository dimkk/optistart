from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

from .memory import MemoryStore
from .mux.base import Multiplexer
from .mux.zellij import ZellijMultiplexer


@dataclass
class SessionState:
    project: str
    status: str
    started_at: str
    stopped_at: str | None
    mux_backend: str
    mux_session_name: str
    layout_path: str
    restored: bool = False


class WorkspaceService:
    def __init__(
        self,
        home_dir: Path,
        multiplexer: Multiplexer | None = None,
        memory_store: MemoryStore | None = None,
    ) -> None:
        self.home_dir = home_dir
        self.sessions_dir = self.home_dir / "sessions"
        self.active_session_file = self.home_dir / "active_session.json"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        self._multiplexer = multiplexer or ZellijMultiplexer()
        self._memory = memory_store

    def start(self, project: str) -> SessionState:
        existing = self._read_session_state(project)
        if existing is not None and existing.status == "running":
            existing.restored = True
            self._write_session_state(project, existing)
            self._write_active_state(existing)
            self._record_memory(existing)
            return existing

        session_dir = self.sessions_dir / project
        session_dir.mkdir(parents=True, exist_ok=True)

        mux_session = self._multiplexer.start_session(project=project, session_dir=session_dir)

        state = SessionState(
            project=project,
            status="running",
            started_at=_now_iso(),
            stopped_at=None,
            mux_backend=mux_session.backend,
            mux_session_name=mux_session.session_name,
            layout_path=str(mux_session.layout_path),
            restored=False,
        )
        self._write_session_state(project, state)
        self._write_active_state(state)
        self._record_memory(state)
        return state

    def stop(self) -> SessionState | None:
        active = self.current_status()
        if active is None:
            return None

        self._multiplexer.stop_session(active.mux_session_name)
        active.status = "stopped"
        active.stopped_at = _now_iso()
        active.restored = False
        self._write_session_state(active.project, active)
        self._write_active_state(active)
        self._record_memory(active)
        return active

    def current_status(self) -> SessionState | None:
        if not self.active_session_file.exists():
            return None
        payload = json.loads(self.active_session_file.read_text(encoding="utf-8"))
        project = payload.get("project")
        if not isinstance(project, str) or not project:
            return None
        return self._read_session_state(project)

    def logs_hint(self) -> str:
        active = self.current_status()
        if active is None:
            return "No active session."
        return f"Logs pane available in session '{active.mux_session_name}'."

    def _write_session_state(self, project: str, state: SessionState) -> None:
        session_file = self.sessions_dir / project / "session.json"
        session_file.write_text(json.dumps(asdict(state), indent=2), encoding="utf-8")

    def _write_active_state(self, state: SessionState) -> None:
        self.active_session_file.write_text(
            json.dumps(
                {
                    "project": state.project,
                    "status": state.status,
                    "mux_backend": state.mux_backend,
                    "mux_session_name": state.mux_session_name,
                    "updated_at": _now_iso(),
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    def _read_session_state(self, project: str) -> SessionState | None:
        session_file = self.sessions_dir / project / "session.json"
        if not session_file.exists():
            return None
        data = json.loads(session_file.read_text(encoding="utf-8"))
        return SessionState(**data)

    def _record_memory(self, state: SessionState) -> None:
        if self._memory is None:
            return
        self._memory.record_session(
            project=state.project,
            status=state.status,
            mux_backend=state.mux_backend,
            mux_session_name=state.mux_session_name,
            started_at=state.started_at,
            stopped_at=state.stopped_at,
        )


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
