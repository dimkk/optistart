from __future__ import annotations

import json
import os
from pathlib import Path

from .config import GlobalConfig, load_global_config, load_project_config
from .discovery import list_projects, resolve_project
from .hooks import HooksRunner
from .memory import MemoryStore
from .mux.factory import create_multiplexer
from .plugin_manager import PluginManager
from .runners import RunnerManager, create_runner
from .workspace import WorkspaceService


class OptiDevApp:
    def __init__(
        self,
        home_dir: Path | None = None,
        workspace: WorkspaceService | None = None,
        runner_manager: RunnerManager | None = None,
        plugin_manager: PluginManager | None = None,
    ) -> None:
        self.home_dir = home_dir or Path.home() / ".optidev"
        self.home_dir.mkdir(parents=True, exist_ok=True)
        self._global_config: GlobalConfig = load_global_config(self.home_dir)
        self._configured_projects_dir = _projects_dir_from_env() or self._global_config.projects_path
        scan_paths_env = _scan_paths_from_env()
        self._scan_paths = scan_paths_env if scan_paths_env is not None else self._global_config.scan_paths
        self.memory = MemoryStore(self.home_dir)
        self.hooks = HooksRunner(self.home_dir)
        self.workspace = workspace or WorkspaceService(
            self.home_dir,
            multiplexer=create_multiplexer(self._global_config.mux_backend),
            memory_store=self.memory,
        )
        self.runner_manager = runner_manager or RunnerManager(
            self.home_dir,
            create_runner(self._global_config.default_runner),
        )
        self.plugin_manager = plugin_manager or PluginManager()
        self.plugin_manager.load_plugins()

    def start_project(self, project: str) -> tuple[bool, list[str]]:
        resolved = resolve_project(
            project_name=project,
            home_dir=self.home_dir,
            configured_projects_dir=self._configured_projects_dir,
            scan_paths=self._scan_paths,
        )
        if resolved is None:
            return False, [f"Project '{project}' not found. Run `optid projects` first."]
        # Validate project-level config before starting workspace.
        project_config = load_project_config(resolved)
        state = self.workspace.start(project)
        hook_processes = self.hooks.start(project, resolved, project_config)
        runner_bootstrap = self.runner_manager.bootstrap(project)
        self.memory.add_message(
            project=project,
            role="system",
            content=f"workspace_start:{state.status}:runner:{runner_bootstrap.runner}",
        )
        self.plugin_manager.on_workspace_start({"project": project, "status": state.status})
        self.plugin_manager.on_agent_message("workspace_started")
        lines = ["OptiDev workspace ready."]
        if state.restored:
            lines.append("Session restored.")
        if hook_processes:
            lines.append(f"Hooks started: {len(hook_processes)}.")
        lines.append(f"Runner ready: {runner_bootstrap.runner}.")
        lines.append("What are we doing today?")
        return True, lines

    def stop(self) -> str:
        active = self.workspace.current_status()
        if active is not None:
            self.hooks.stop(active.project)
            self.plugin_manager.on_workspace_stop({"project": active.project, "status": active.status})
        stopped = self.workspace.stop()
        if stopped is None:
            return "No active session to stop."
        return f"Stopped session '{stopped.mux_session_name}'."

    def status(self) -> str:
        status = self.workspace.current_status()
        if status is None:
            return "No active session."
        runner = self._runner_name(status.project)
        hooks_total, hooks_running = self._hooks_summary(status.project)
        return (
            f"Project: {status.project} | Status: {status.status} | "
            f"Mux: {status.mux_backend} | Session: {status.mux_session_name} | "
            f"Runner: {runner} | Hooks: {hooks_running}/{hooks_total} running"
        )

    def logs(self) -> str:
        status = self.workspace.current_status()
        if status is None:
            return "No active session."
        hooks_file = self._session_dir(status.project) / "hooks.json"
        if not hooks_file.exists():
            return "No logs sources configured."
        data = json.loads(hooks_file.read_text(encoding="utf-8"))
        lines = [
            f"{item['command']} [{item['status']}]"
            for item in data
            if item.get("group") == "logs.sources"
        ]
        if not lines:
            return "No logs sources configured."
        return "Log sources:\n" + "\n".join(lines)

    def projects(self) -> list[str]:
        projects = list_projects(
            home_dir=self.home_dir,
            configured_projects_dir=self._configured_projects_dir,
            scan_paths=self._scan_paths,
        )
        if not projects:
            return ["No projects found."]
        return projects

    def _session_dir(self, project: str) -> Path:
        return self.home_dir / "sessions" / project

    def _runner_name(self, project: str) -> str:
        path = self._session_dir(project) / "runner.json"
        if not path.exists():
            return "unknown"
        data = json.loads(path.read_text(encoding="utf-8"))
        return str(data.get("runner", "unknown"))

    def _hooks_summary(self, project: str) -> tuple[int, int]:
        path = self._session_dir(project) / "hooks.json"
        if not path.exists():
            return (0, 0)
        data = json.loads(path.read_text(encoding="utf-8"))
        total = len(data)
        running = sum(1 for item in data if item.get("status") == "running")
        return (total, running)


def _projects_dir_from_env() -> Path | None:
    raw = os.environ.get("OPTIDEV_PROJECTS_DIR")
    if not raw:
        return None
    return Path(raw).expanduser()


def _scan_paths_from_env() -> list[Path] | None:
    raw = os.environ.get("OPTIDEV_SCAN_PATHS")
    if raw is None:
        return None
    values = [part.strip() for part in raw.split(":") if part.strip()]
    return [Path(value).expanduser() for value in values]
