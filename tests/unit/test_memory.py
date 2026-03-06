from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from optidev.memory import MemoryStore


class MemoryUnitTests(unittest.TestCase):
    def test_schema_and_crud(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = MemoryStore(Path(tmp))
            store.record_session(
                project="demo",
                status="running",
                mux_backend="zellij",
                mux_session_name="optid-demo",
                started_at="2026-01-01T00:00:00Z",
                stopped_at=None,
            )
            store.add_message(project="demo", role="system", content="hello")
            store.add_task(project="demo", title="t1", status="open")
            store.add_decision(project="demo", key="k", value="v")

            sessions = store.recent_sessions(project="demo")
            messages = store.recent_messages(project="demo")

            self.assertEqual(len(sessions), 1)
            self.assertEqual(sessions[0]["status"], "running")
            self.assertEqual(len(messages), 1)
            self.assertEqual(messages[0]["content"], "hello")


if __name__ == "__main__":
    unittest.main()
