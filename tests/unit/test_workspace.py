from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from optidev.mux.base import MuxSession
from optidev.workspace import WorkspaceService


class FakeMultiplexer:
    backend_name = "zellij"

    def __init__(self) -> None:
        self.start_calls = 0
        self.stop_calls = 0

    def start_session(self, project: str, session_dir: Path) -> MuxSession:
        self.start_calls += 1
        layout = session_dir / "layout.kdl"
        layout.write_text("layout {}\n", encoding="utf-8")
        return MuxSession(backend="zellij", session_name=f"optid-{project}", layout_path=layout)

    def stop_session(self, session_name: str) -> None:
        self.stop_calls += 1


class WorkspaceUnitTests(unittest.TestCase):
    def test_lifecycle_transitions_with_restore(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            mux = FakeMultiplexer()
            service = WorkspaceService(home_dir=Path(tmp), multiplexer=mux)

            first = service.start("demo")
            self.assertEqual(first.status, "running")
            self.assertFalse(first.restored)
            self.assertEqual(mux.start_calls, 1)

            restored = service.start("demo")
            self.assertTrue(restored.restored)
            self.assertEqual(mux.start_calls, 1)

            stopped = service.stop()
            self.assertIsNotNone(stopped)
            assert stopped is not None
            self.assertEqual(stopped.status, "stopped")
            self.assertEqual(mux.stop_calls, 1)

            restarted = service.start("demo")
            self.assertFalse(restarted.restored)
            self.assertEqual(mux.start_calls, 2)


if __name__ == "__main__":
    unittest.main()
