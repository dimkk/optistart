from __future__ import annotations

import json
import os
import signal
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path

from .config import ProjectConfig


@dataclass
class HookProcess:
    group: str
    command: str
    pid: int | None
    status: str


class HooksRunner:
    def __init__(self, home_dir: Path, disable_hooks: bool | None = None) -> None:
        self.home_dir = home_dir
        if disable_hooks is None:
            disable_hooks = os.environ.get("OPTIDEV_DISABLE_HOOKS", "0") == "1"
        self.disable_hooks = disable_hooks
        self._live_procs: dict[int, subprocess.Popen[bytes]] = {}

    def start(self, project: str, project_path: Path, project_config: ProjectConfig) -> list[HookProcess]:
        commands = self._normalize(project_config)
        processes: list[HookProcess] = []

        if self.disable_hooks:
            self._write_hooks(project, processes)
            return processes

        for group, command in commands:
            proc = subprocess.Popen(
                ["bash", "-lc", command],
                cwd=project_path,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            status = "running" if proc.poll() is None else f"exited:{proc.returncode}"
            if proc.pid is not None and status == "running":
                self._live_procs[proc.pid] = proc
            processes.append(HookProcess(group=group, command=command, pid=proc.pid, status=status))

        self._write_hooks(project, processes)
        return processes

    def stop(self, project: str) -> list[HookProcess]:
        hooks = self._read_hooks(project)
        for hook in hooks:
            if hook.pid is None:
                continue
            if hook.status != "running":
                continue
            try:
                os.killpg(hook.pid, signal.SIGTERM)
                hook.status = "stopped"
                live = self._live_procs.pop(hook.pid, None)
                if live is not None:
                    try:
                        live.wait(timeout=0.5)
                    except subprocess.TimeoutExpired:
                        pass
            except ProcessLookupError:
                hook.status = "exited"
            except OSError:
                hook.status = "unknown"

        self._write_hooks(project, hooks)
        return hooks

    @staticmethod
    def _normalize(project_config: ProjectConfig) -> list[tuple[str, str]]:
        normalized: list[tuple[str, str]] = []
        for cmd in project_config.dev.start:
            normalized.append(("dev.start", cmd))
        for cmd in project_config.tests.watch:
            normalized.append(("tests.watch", cmd))
        for cmd in project_config.logs.sources:
            normalized.append(("logs.sources", cmd))
        return normalized

    def _hooks_file(self, project: str) -> Path:
        session_dir = self.home_dir / "sessions" / project
        session_dir.mkdir(parents=True, exist_ok=True)
        return session_dir / "hooks.json"

    def _write_hooks(self, project: str, hooks: list[HookProcess]) -> None:
        self._hooks_file(project).write_text(
            json.dumps([asdict(hook) for hook in hooks], indent=2),
            encoding="utf-8",
        )

    def _read_hooks(self, project: str) -> list[HookProcess]:
        path = self._hooks_file(project)
        if not path.exists():
            return []
        data = json.loads(path.read_text(encoding="utf-8"))
        return [HookProcess(**item) for item in data]
