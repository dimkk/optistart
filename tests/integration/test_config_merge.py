from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from optidev.config import load_effective_config


class ConfigIntegrationTests(unittest.TestCase):
    def test_load_global_and_project_config(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            projects_root = base / "projects-root"
            project = projects_root / "alpha"
            (project / ".project").mkdir(parents=True, exist_ok=True)

            (base / "config.yaml").write_text(
                json.dumps(
                    {
                        "default_runner": "claude",
                        "workspace_layout": "default",
                        "projects_path": str(projects_root),
                        "scan_paths": [str(base / "dev")],
                        "mux_backend": "zellij",
                    }
                ),
                encoding="utf-8",
            )

            (project / ".project" / "config.yaml").write_text(
                json.dumps(
                    {
                        "dev": {"start": ["docker compose up"]},
                        "tests": {"command": "pytest -q", "watch": ["pytest -q"]},
                        "logs": {"sources": ["docker logs app"]},
                    }
                ),
                encoding="utf-8",
            )

            cfg = load_effective_config(base, project)
            self.assertEqual(cfg.global_config.default_runner, "claude")
            self.assertEqual(cfg.global_config.projects_path, projects_root)
            self.assertEqual(cfg.project_config.tests.command, "pytest -q")
            self.assertEqual(cfg.project_config.dev.start, ["docker compose up"])
            self.assertEqual(cfg.project_config.logs.sources, ["docker logs app"])


if __name__ == "__main__":
    unittest.main()
