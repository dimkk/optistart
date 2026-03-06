from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from optidev.discovery import list_projects, resolve_project


class DiscoveryIntegrationTests(unittest.TestCase):
    def test_scan_multiple_roots_and_resolve(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            configured = base / "configured"
            dev = base / "dev"
            misc = base / "projects"

            (configured / "alpha").mkdir(parents=True, exist_ok=True)
            (dev / "beta").mkdir(parents=True, exist_ok=True)
            (misc / "gamma").mkdir(parents=True, exist_ok=True)

            projects = list_projects(
                home_dir=base,
                configured_projects_dir=configured,
                scan_paths=[dev, misc],
            )
            self.assertEqual(projects, ["alpha", "beta", "gamma"])

            beta_path = resolve_project(
                project_name="beta",
                home_dir=base,
                configured_projects_dir=configured,
                scan_paths=[dev, misc],
            )
            self.assertEqual(beta_path, dev / "beta")


if __name__ == "__main__":
    unittest.main()
