from __future__ import annotations

import os
import subprocess
import textwrap
from pathlib import Path
from typing import Callable

from .base import Multiplexer, MuxSession


class ZellijMultiplexer(Multiplexer):
    backend_name = "zellij"

    def __init__(
        self,
        disable_launch: bool | None = None,
        popen_factory: Callable[..., object] | None = None,
        run_func: Callable[..., object] | None = None,
    ) -> None:
        if disable_launch is None:
            disable_launch = os.environ.get("OPTIDEV_DISABLE_ZELLIJ", "0") == "1"
        self.disable_launch = disable_launch
        self._popen_factory = popen_factory or subprocess.Popen
        self._run_func = run_func or subprocess.run

    def start_session(self, project: str, session_dir: Path) -> MuxSession:
        session_name = self.session_name_for(project)
        layout_path = session_dir / "layout.kdl"
        self.render_layout(layout_path)

        if not self.disable_launch:
            # Fire-and-forget: avoid blocking CLI when user runs in interactive shell.
            self._popen_factory(
                self.build_start_command(session_name, layout_path),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )

        return MuxSession(
            backend=self.backend_name,
            session_name=session_name,
            layout_path=layout_path,
        )

    def stop_session(self, session_name: str) -> None:
        self._run_func(
            self.build_stop_command(session_name),
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def render_layout(self, layout_path: Path) -> None:
        layout_path.write_text(self._default_layout(), encoding="utf-8")

    @staticmethod
    def session_name_for(project: str) -> str:
        safe = "".join(ch if (ch.isalnum() or ch in "-_") else "-" for ch in project.strip())
        safe = safe.strip("-_") or "project"
        return f"optid-{safe}"

    @staticmethod
    def build_start_command(session_name: str, layout_path: Path) -> list[str]:
        return [
            "zellij",
            "--session",
            session_name,
            "--new-session-with-layout",
            str(layout_path),
        ]

    @staticmethod
    def build_stop_command(session_name: str) -> list[str]:
        return ["zellij", "kill-session", session_name]

    @staticmethod
    def _default_layout() -> str:
        return textwrap.dedent(
            """\
            layout {
              pane split_direction="vertical" {
                pane split_direction="horizontal" {
                  pane name="planner" command="bash" {
                    args "-lc" "echo planner agent"
                  }
                  pane name="coder" command="bash" {
                    args "-lc" "echo coder agent"
                  }
                }
                pane split_direction="horizontal" {
                  pane name="tests" command="bash" {
                    args "-lc" "echo tests"
                  }
                  pane name="logs" command="bash" {
                    args "-lc" "echo logs"
                  }
                }
              }
            }
            """
        )
