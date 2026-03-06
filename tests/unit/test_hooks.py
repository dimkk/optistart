from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from optidev.config import ProjectConfig, ProjectDevConfig, ProjectLogsConfig, ProjectTestsConfig
from optidev.hooks import HooksRunner


class HooksUnitTests(unittest.TestCase):
    def test_command_normalization(self) -> None:
        cfg = ProjectConfig(
            dev=ProjectDevConfig(start=["npm run dev"]),
            tests=ProjectTestsConfig(watch=["pytest -q"]),
            logs=ProjectLogsConfig(sources=["tail -f app.log"]),
        )
        commands = HooksRunner._normalize(cfg)
        self.assertEqual(
            commands,
            [
                ("dev.start", "npm run dev"),
                ("tests.watch", "pytest -q"),
                ("logs.sources", "tail -f app.log"),
            ],
        )

    def test_disable_hooks_writes_empty_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            runner = HooksRunner(Path(tmp), disable_hooks=True)
            project = Path(tmp) / "demo"
            project.mkdir(parents=True, exist_ok=True)
            hooks = runner.start("demo", project, ProjectConfig())
            self.assertEqual(hooks, [])


if __name__ == "__main__":
    unittest.main()
