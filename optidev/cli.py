from __future__ import annotations

import sys
import os
from pathlib import Path
from typing import TextIO

from .app import OptiDevApp
from .config import ConfigError

USAGE = "Usage: optid <project> | optid [stop|status|logs|projects]"


def run(argv: list[str] | None = None, *, out: TextIO | None = None, err: TextIO | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    stdout = out or sys.stdout
    stderr = err or sys.stderr

    home_override = Path(os.environ["OPTIDEV_HOME"]) if "OPTIDEV_HOME" in os.environ else None
    try:
        app = OptiDevApp(home_dir=home_override)
    except ConfigError as exc:
        print(f"Config error: {exc}", file=stderr)
        return 1

    if not args:
        print(USAGE, file=stderr)
        return 2

    command = args[0]

    if command == "stop":
        print(app.stop(), file=stdout)
        return 0
    if command == "status":
        print(app.status(), file=stdout)
        return 0
    if command == "logs":
        print(app.logs(), file=stdout)
        return 0
    if command == "projects":
        for line in app.projects():
            print(line, file=stdout)
        return 0

    if command.startswith("-"):
        print(USAGE, file=stderr)
        return 2

    try:
        ok, lines = app.start_project(command)
    except ConfigError as exc:
        print(f"Config error: {exc}", file=stderr)
        return 1
    for line in lines:
        print(line, file=stdout)
    return 0 if ok else 1


def main() -> int:
    return run()
