from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from optidev.discovery import discovery_roots, list_projects


class DiscoveryUnitTests(unittest.TestCase):
    def test_discovery_roots_priority_and_dedup(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            configured = home / "projects"
            roots = discovery_roots(
                home_dir=home,
                configured_projects_dir=configured,
                scan_paths=[configured, home / "dev"],
            )
            self.assertEqual(roots, [configured, home / "dev"])

    def test_list_projects_returns_sorted_names(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            root = home / "projects"
            (root / "zeta").mkdir(parents=True, exist_ok=True)
            (root / "alpha").mkdir(parents=True, exist_ok=True)

            projects = list_projects(home_dir=home, configured_projects_dir=root, scan_paths=[])
            self.assertEqual(projects, ["alpha", "zeta"])


if __name__ == "__main__":
    unittest.main()
