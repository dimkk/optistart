from __future__ import annotations

import unittest

from optidev.runners.claude import ClaudeRunner
from optidev.runners.codex import CodexRunner
from optidev.runners.factory import create_runner


class RunnerApiUnitTests(unittest.TestCase):
    def test_codex_runner_contract(self) -> None:
        runner = CodexRunner()
        self.assertEqual(runner.name, "codex")
        self.assertEqual(runner.run("task"), "codex:run:task")
        self.assertEqual(runner.resume("sid"), "codex:resume:sid")
        self.assertEqual(runner.stop(), "codex:stop")

    def test_claude_runner_contract(self) -> None:
        runner = ClaudeRunner()
        self.assertEqual(runner.name, "claude")
        self.assertEqual(runner.run("task"), "claude:run:task")
        self.assertEqual(runner.resume("sid"), "claude:resume:sid")
        self.assertEqual(runner.stop(), "claude:stop")

    def test_factory_selection(self) -> None:
        self.assertEqual(create_runner("codex").name, "codex")
        self.assertEqual(create_runner("claude").name, "claude")
        with self.assertRaises(ValueError):
            create_runner("bad")


if __name__ == "__main__":
    unittest.main()
