from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from optidev.app import OptiDevApp
from optidev.mux.base import MuxSession
from optidev.workspace import WorkspaceService


class SpyMultiplexer:
    backend_name = "zellij"

    def __init__(self) -> None:
        self.started = False
        self.stopped = False

    def start_session(self, project: str, session_dir: Path) -> MuxSession:
        self.started = True
        layout = session_dir / "layout.kdl"
        layout.write_text("layout {}\n", encoding="utf-8")
        return MuxSession(backend="zellij", session_name=f"optid-{project}", layout_path=layout)

    def stop_session(self, session_name: str) -> None:
        self.stopped = True


class MuxAbstractionIntegrationTests(unittest.TestCase):
    def test_workspace_lifecycle_uses_multiplexer_contract(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            (home / "projects" / "app").mkdir(parents=True, exist_ok=True)
            spy_mux = SpyMultiplexer()
            workspace = WorkspaceService(home, multiplexer=spy_mux)
            app = OptiDevApp(home_dir=home, workspace=workspace)

            ok, _ = app.start_project("app")
            self.assertTrue(ok)
            self.assertTrue(spy_mux.started)

            app.stop()
            self.assertTrue(spy_mux.stopped)


if __name__ == "__main__":
    unittest.main()
