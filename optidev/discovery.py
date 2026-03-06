from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


def default_projects_dir(home_dir: Path) -> Path:
    return home_dir / "projects"


def default_scan_paths(user_home: Path | None = None) -> list[Path]:
    base = user_home or Path.home()
    return [base / "dev", base / "projects"]


def discovery_roots(
    home_dir: Path,
    configured_projects_dir: Path | None = None,
    scan_paths: Iterable[Path] | None = None,
) -> list[Path]:
    roots: list[Path] = []
    seen: set[str] = set()
    candidates = [configured_projects_dir or default_projects_dir(home_dir)]
    candidates.extend(list(scan_paths) if scan_paths is not None else default_scan_paths())

    for raw in candidates:
        candidate = raw.expanduser()
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        roots.append(candidate)
    return roots


@dataclass(frozen=True)
class ProjectRecord:
    name: str
    path: Path
    source_root: Path


def discover_projects(
    home_dir: Path,
    configured_projects_dir: Path | None = None,
    scan_paths: Iterable[Path] | None = None,
) -> list[ProjectRecord]:
    discovered: dict[str, ProjectRecord] = {}
    for root in discovery_roots(home_dir, configured_projects_dir, scan_paths):
        if not root.exists() or not root.is_dir():
            continue
        for entry in root.iterdir():
            if not entry.is_dir():
                continue
            # Keep first match by root precedence.
            if entry.name not in discovered:
                discovered[entry.name] = ProjectRecord(
                    name=entry.name,
                    path=entry,
                    source_root=root,
                )
    return sorted(discovered.values(), key=lambda rec: rec.name)


def list_projects(
    home_dir: Path,
    configured_projects_dir: Path | None = None,
    scan_paths: Iterable[Path] | None = None,
) -> list[str]:
    return [project.name for project in discover_projects(home_dir, configured_projects_dir, scan_paths)]


def resolve_project(
    project_name: str,
    home_dir: Path,
    configured_projects_dir: Path | None = None,
    scan_paths: Iterable[Path] | None = None,
) -> Path | None:
    for project in discover_projects(home_dir, configured_projects_dir, scan_paths):
        if project.name == project_name:
            return project.path
    return None
