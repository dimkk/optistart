from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from optidev.config import ConfigError, load_global_config


class ConfigUnitTests(unittest.TestCase):
    def test_global_defaults_when_file_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            cfg = load_global_config(home)
            self.assertEqual(cfg.default_runner, "codex")
            self.assertEqual(cfg.workspace_layout, "default")
            self.assertEqual(cfg.projects_path, home / "projects")
            self.assertEqual(cfg.mux_backend, "zellij")

    def test_global_validation_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            (home / "config.yaml").write_text(
                json.dumps({"default_runner": 123}),
                encoding="utf-8",
            )
            with self.assertRaises(ConfigError):
                load_global_config(home)


if __name__ == "__main__":
    unittest.main()
