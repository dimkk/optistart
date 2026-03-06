from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from optidev.mux.base import MuxSession
from optidev.workspace import WorkspaceService


class FakeMultiplexer:
    backend_name = "zellij"

    def start_session(self, project: str, session_dir: Path) -> MuxSession:
        layout = session_dir / "layout.kdl"
        layout.write_text("layout {}\n", encoding="utf-8")
        return MuxSession(backend="zellij", session_name=f"optid-{project}", layout_path=layout)

    def stop_session(self, session_name: str) -> None:
        return


class WorkspacePersistenceIntegrationTests(unittest.TestCase):
    def test_session_files_and_active_metadata_persist(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            service = WorkspaceService(home_dir=home, multiplexer=FakeMultiplexer())
            service.start("alpha")

            session_file = home / "sessions" / "alpha" / "session.json"
            active_file = home / "active_session.json"

            self.assertTrue(session_file.exists())
            self.assertTrue(active_file.exists())

            active = json.loads(active_file.read_text(encoding="utf-8"))
            self.assertEqual(active["project"], "alpha")
            self.assertEqual(active["status"], "running")
            self.assertEqual(active["mux_backend"], "zellij")

            service2 = WorkspaceService(home_dir=home, multiplexer=FakeMultiplexer())
            status = service2.current_status()
            self.assertIsNotNone(status)
            assert status is not None
            self.assertEqual(status.project, "alpha")
            self.assertEqual(status.status, "running")


if __name__ == "__main__":
    unittest.main()
