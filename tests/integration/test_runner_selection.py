from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from optidev.app import OptiDevApp


class RunnerSelectionIntegrationTests(unittest.TestCase):
    def test_runner_selected_from_global_config(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            try:
                home = Path(tmp)
                (home / "config.yaml").write_text(
                    json.dumps({"default_runner": "claude"}),
                    encoding="utf-8",
                )
                (home / "projects" / "demo").mkdir(parents=True, exist_ok=True)

                app = OptiDevApp(home_dir=home)
                ok, _ = app.start_project("demo")
                self.assertTrue(ok)

                runner_file = home / "sessions" / "demo" / "runner.json"
                self.assertTrue(runner_file.exists())
                data = json.loads(runner_file.read_text(encoding="utf-8"))
                self.assertEqual(data["runner"], "claude")
            finally:
                os.environ.pop("OPTIDEV_DISABLE_ZELLIJ", None)


if __name__ == "__main__":
    unittest.main()
