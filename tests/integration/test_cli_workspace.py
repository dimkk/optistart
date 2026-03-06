from __future__ import annotations

import io
import os
import tempfile
import unittest
from pathlib import Path

from optidev import cli


class CliWorkspaceIntegrationTests(unittest.TestCase):
    def test_start_status_stop_flow(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["OPTIDEV_HOME"] = tmp
            os.environ["OPTIDEV_DISABLE_ZELLIJ"] = "1"
            os.environ["OPTIDEV_SCAN_PATHS"] = ""
            projects_root = Path(tmp) / "projects"
            (projects_root / "demo").mkdir(parents=True, exist_ok=True)

            out = io.StringIO()
            err = io.StringIO()
            self.assertEqual(cli.run(["demo"], out=out, err=err), 0)
            self.assertIn("OptiDev workspace ready.", out.getvalue())

            out = io.StringIO()
            self.assertEqual(cli.run(["status"], out=out, err=err), 0)
            self.assertIn("Project: demo", out.getvalue())
            self.assertIn("Mux: zellij", out.getvalue())

            out = io.StringIO()
            self.assertEqual(cli.run(["stop"], out=out, err=err), 0)
            self.assertIn("Stopped session", out.getvalue())

            out = io.StringIO()
            self.assertEqual(cli.run(["status"], out=out, err=err), 0)
            self.assertIn("Status: stopped", out.getvalue())

            os.environ.pop("OPTIDEV_HOME", None)
            os.environ.pop("OPTIDEV_DISABLE_ZELLIJ", None)
            os.environ.pop("OPTIDEV_SCAN_PATHS", None)


if __name__ == "__main__":
    unittest.main()
