from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from optidev.app import OptiDevApp


class StatusObservabilityUnitTests(unittest.TestCase):
    def test_status_includes_runner_and_hooks_summary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            os.environ["OPTIDEV_DISABLE_HOOKS"] = "1"
            try:
                home = Path(tmp)
                (home / "projects" / "demo").mkdir(parents=True, exist_ok=True)
                app = OptiDevApp(home_dir=home)
                ok, _ = app.start_project("demo")
                self.assertTrue(ok)
                status = app.status()
                self.assertIn("Runner:", status)
                self.assertIn("Hooks:", status)
            finally:
                os.environ.pop("OPTIDEV_DISABLE_ZELLIJ", None)
                os.environ.pop("OPTIDEV_DISABLE_HOOKS", None)


if __name__ == "__main__":
    unittest.main()
