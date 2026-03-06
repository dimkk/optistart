from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from optidev.app import OptiDevApp


class StatusLogsLookupIntegrationTests(unittest.TestCase):
    def test_logs_resolve_from_hook_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            try:
                home = Path(tmp)
                project = home / "projects" / "obs"
                (project / ".project").mkdir(parents=True, exist_ok=True)
                (project / ".project" / "config.yaml").write_text(
                    json.dumps({"logs": {"sources": ["echo integration-log"]}}),
                    encoding="utf-8",
                )

                app = OptiDevApp(home_dir=home)
                ok, _ = app.start_project("obs")
                self.assertTrue(ok)

                logs = app.logs()
                self.assertIn("integration-log", logs)
                status = app.status()
                self.assertIn("Runner:", status)
                self.assertIn("Hooks:", status)
                app.stop()
            finally:
                os.environ.pop("OPTIDEV_DISABLE_ZELLIJ", None)


if __name__ == "__main__":
    unittest.main()
