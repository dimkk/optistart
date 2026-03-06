from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from optidev.mux.zellij import ZellijMultiplexer


class ZellijMuxUnitTests(unittest.TestCase):
    def test_session_name_is_sanitized(self) -> None:
        name = ZellijMultiplexer.session_name_for("my project/feature")
        self.assertEqual(name, "optid-my-project-feature")

    def test_command_builders(self) -> None:
        layout = Path("/tmp/layout.kdl")
        self.assertEqual(
            ZellijMultiplexer.build_start_command("optid-demo", layout),
            ["zellij", "--session", "optid-demo", "--new-session-with-layout", str(layout)],
        )
        self.assertEqual(
            ZellijMultiplexer.build_stop_command("optid-demo"),
            ["zellij", "kill-session", "optid-demo"],
        )

    def test_layout_contains_expected_panes(self) -> None:
        mux = ZellijMultiplexer(disable_launch=True)
        with tempfile.TemporaryDirectory() as tmp:
            layout = Path(tmp) / "layout.kdl"
            mux.render_layout(layout)
            content = layout.read_text(encoding="utf-8")
            self.assertIn('pane name="planner"', content)
            self.assertIn('pane name="coder"', content)
            self.assertIn('pane name="tests"', content)
            self.assertIn('pane name="logs"', content)


if __name__ == "__main__":
    unittest.main()
