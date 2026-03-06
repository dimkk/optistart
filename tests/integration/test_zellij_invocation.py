from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from optidev.mux.zellij import ZellijMultiplexer


class ZellijInvocationIntegrationTests(unittest.TestCase):
    def test_start_and_stop_subprocess_contract(self) -> None:
        calls: dict[str, object] = {}

        def fake_popen(cmd: list[str], **kwargs: object) -> object:
            calls["start_cmd"] = cmd
            calls["start_kwargs"] = kwargs
            return object()

        def fake_run(cmd: list[str], **kwargs: object) -> object:
            calls["stop_cmd"] = cmd
            calls["stop_kwargs"] = kwargs
            return object()

        mux = ZellijMultiplexer(disable_launch=False, popen_factory=fake_popen, run_func=fake_run)

        with tempfile.TemporaryDirectory() as tmp:
            session = mux.start_session("demo", Path(tmp))
            mux.stop_session(session.session_name)

        self.assertEqual(
            calls["start_cmd"],
            ["zellij", "--session", "optid-demo", "--new-session-with-layout", str(Path(tmp) / "layout.kdl")],
        )
        self.assertEqual(calls["stop_cmd"], ["zellij", "kill-session", "optid-demo"])


if __name__ == "__main__":
    unittest.main()
