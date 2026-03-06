from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class GlobalConfig:
    default_runner: str = "codex"
    workspace_layout: str = "default"
    projects_path: Path = Path("~/.optidev/projects")
    scan_paths: list[Path] = field(default_factory=lambda: [Path("~/dev"), Path("~/projects")])
    mux_backend: str = "zellij"


@dataclass(frozen=True)
class ProjectDevConfig:
    start: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ProjectTestsConfig:
    command: str | None = None
    watch: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ProjectLogsConfig:
    sources: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ProjectConfig:
    dev: ProjectDevConfig = field(default_factory=ProjectDevConfig)
    tests: ProjectTestsConfig = field(default_factory=ProjectTestsConfig)
    logs: ProjectLogsConfig = field(default_factory=ProjectLogsConfig)


@dataclass(frozen=True)
class EffectiveConfig:
    global_config: GlobalConfig
    project_config: ProjectConfig


def load_global_config(home_dir: Path) -> GlobalConfig:
    config_path = home_dir / "config.yaml"
    defaults = GlobalConfig(projects_path=home_dir / "projects")
    if not config_path.exists():
        return defaults

    data = _load_mapping(config_path)
    default_runner = _expect_string(data, "default_runner", defaults.default_runner)
    workspace_layout = _expect_string(data, "workspace_layout", defaults.workspace_layout)
    mux_backend = _expect_string(data, "mux_backend", defaults.mux_backend)

    projects_value = data.get("projects_path", str(defaults.projects_path))
    if not isinstance(projects_value, str):
        raise ConfigError("global config field 'projects_path' must be string path")
    projects_path = Path(projects_value).expanduser()

    scan_raw = data.get("scan_paths")
    if scan_raw is None:
        scan_paths = defaults.scan_paths
    else:
        if not isinstance(scan_raw, list) or any(not isinstance(item, str) for item in scan_raw):
            raise ConfigError("global config field 'scan_paths' must be list of string paths")
        scan_paths = [Path(item).expanduser() for item in scan_raw]

    if mux_backend != "zellij":
        raise ConfigError("global config field 'mux_backend' supports only 'zellij' in MVP")
    if default_runner not in {"codex", "claude"}:
        raise ConfigError("global config field 'default_runner' supports only 'codex' or 'claude'")

    return GlobalConfig(
        default_runner=default_runner,
        workspace_layout=workspace_layout,
        projects_path=projects_path,
        scan_paths=scan_paths,
        mux_backend=mux_backend,
    )


def load_project_config(project_path: Path) -> ProjectConfig:
    config_path = project_path / ".project" / "config.yaml"
    if not config_path.exists():
        return ProjectConfig()

    data = _load_mapping(config_path)

    dev_data = _expect_mapping(data, "dev", default={})
    tests_data = _expect_mapping(data, "tests", default={})
    logs_data = _expect_mapping(data, "logs", default={})

    dev_start = _expect_string_list(dev_data, "start", default=[])
    tests_watch = _expect_string_list(tests_data, "watch", default=[])

    tests_command = tests_data.get("command")
    if tests_command is not None and not isinstance(tests_command, str):
        raise ConfigError("project config field 'tests.command' must be string")

    logs_sources = _expect_string_list(logs_data, "sources", default=[])

    return ProjectConfig(
        dev=ProjectDevConfig(start=dev_start),
        tests=ProjectTestsConfig(command=tests_command, watch=tests_watch),
        logs=ProjectLogsConfig(sources=logs_sources),
    )


def load_effective_config(home_dir: Path, project_path: Path) -> EffectiveConfig:
    return EffectiveConfig(
        global_config=load_global_config(home_dir),
        project_config=load_project_config(project_path),
    )


def _load_mapping(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")

    loaded: Any
    try:
        import yaml  # type: ignore[import-not-found]

        loaded = yaml.safe_load(text)
    except Exception:
        try:
            loaded = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ConfigError(f"unable to parse config: {path}") from exc

    if loaded is None:
        return {}
    if not isinstance(loaded, dict):
        raise ConfigError(f"config root must be mapping: {path}")
    return loaded


def _expect_string(data: dict[str, Any], key: str, default: str) -> str:
    value = data.get(key)
    if value is None:
        return default
    if not isinstance(value, str):
        raise ConfigError(f"global config field '{key}' must be string")
    return value


def _expect_mapping(data: dict[str, Any], key: str, default: dict[str, Any]) -> dict[str, Any]:
    value = data.get(key)
    if value is None:
        return default
    if not isinstance(value, dict):
        raise ConfigError(f"project config field '{key}' must be mapping")
    return value


def _expect_string_list(data: dict[str, Any], key: str, default: list[str]) -> list[str]:
    value = data.get(key)
    if value is None:
        return default
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise ConfigError(f"project config field '{key}' must be list of strings")
    return value
