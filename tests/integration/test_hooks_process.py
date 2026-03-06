from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from optidev.config import ProjectConfig, ProjectDevConfig
from optidev.hooks import HooksRunner


class HooksProcessIntegrationTests(unittest.TestCase):
    def test_start_and_stop_hook_processes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            project_dir = home / "project"
            project_dir.mkdir(parents=True, exist_ok=True)
            runner = HooksRunner(home, disable_hooks=False)
            cfg = ProjectConfig(dev=ProjectDevConfig(start=["sleep 5"]))

            started = runner.start("demo", project_dir, cfg)
            self.assertEqual(len(started), 1)
            self.assertEqual(started[0].status, "running")

            stopped = runner.stop("demo")
            self.assertEqual(len(stopped), 1)
            self.assertIn(stopped[0].status, {"stopped", "exited", "unknown"})

            hooks_file = home / "sessions" / "demo" / "hooks.json"
            self.assertTrue(hooks_file.exists())
            persisted = json.loads(hooks_file.read_text(encoding="utf-8"))
            self.assertEqual(len(persisted), 1)


if __name__ == "__main__":
    unittest.main()
