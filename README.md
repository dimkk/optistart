# OptiDev (`optid`)

A local CLI workspace orchestrator for AI coding sessions.

## Current Status
MVP is implemented and tested.

Available commands:

- `optid <project>`
- `optid stop`
- `optid status`
- `optid logs`
- `optid projects`

Implemented subsystems:

- terminal multiplexer abstraction (MVP backend: `zellij`)
- runner abstraction (`codex`, `claude`)
- project discovery
- global + project config loading/validation
- workspace session bootstrap + restore
- SQLite memory store (`~/.optidev/memory.sqlite`)
- dev/tests/log hooks execution
- plugin lifecycle (`start`, `message`, `stop`)

## Prerequisites
Before installation:

- `bash`
- `python3` `3.12+` (required)
- `git` (required only if installer needs to clone)
- `curl` (required for `curl | bash` install flow)
- `zellij` (required for full runtime behavior)
- `uv` (optional, recommended for local development workflows)

## Installation

### Local repo already present
If you are in the project root (contains `scripts/optid` and `optidev/`), run:

```bash
./scripts/install.sh
```

This installs/updates the CLI shim to `~/.local/bin/optid` and ensures PATH export in your shell rc.

### Remote install via curl
Default install command:

```bash
curl -fsSL https://raw.githubusercontent.com/dimkk/optistart/main/scripts/install.sh | bash
```

Optional override (for fork/private mirror):

```bash
curl -fsSL https://raw.githubusercontent.com/dimkk/optistart/main/scripts/install.sh | OPTID_GIT_URL=<YOUR_GIT_URL> bash
```

Installer behavior:

1. If local repo layout is detected, it uses local files only.
2. If local repo is not detected, it clones/pulls from `https://github.com/dimkk/optistart` (or `OPTID_GIT_URL` if overridden).
3. It links `optid` into `~/.local/bin` and adds PATH export automatically.

## Quick Start

```bash
mkdir -p ~/.optidev/projects/demo
optid projects
optid demo
optid status
optid logs
optid stop
```

If your shell has not reloaded PATH yet, use:

```bash
~/.local/bin/optid status
```

## Data Layout
Default state root: `~/.optidev`

- `config.yaml` — global config
- `memory.sqlite` — persisted memory
- `active_session.json` — active session pointer
- `sessions/<project>/session.json` — session state
- `sessions/<project>/layout.kdl` — generated zellij layout
- `sessions/<project>/runner.json` — runner bootstrap metadata
- `sessions/<project>/hooks.json` — hook process metadata

Use isolated state root:

```bash
OPTIDEV_HOME=/tmp/optid-home optid projects
```

## Configuration

### Global config
Path: `~/.optidev/config.yaml`

Supported fields:

- `default_runner`: `codex | claude`
- `workspace_layout`: string (informational in MVP)
- `projects_path`: projects root path
- `scan_paths`: additional discovery paths
- `mux_backend`: only `zellij` in MVP

Example:

```yaml
default_runner: codex
workspace_layout: default
projects_path: ~/.optidev/projects
scan_paths:
  - ~/dev
  - ~/projects
mux_backend: zellij
```

### Project config
Path: `<project>/.project/config.yaml`

Supported fields:

- `dev.start`: startup commands
- `tests.command`: test command
- `tests.watch`: watch commands
- `logs.sources`: log source commands

Example:

```yaml
dev:
  start:
    - docker compose up -d

tests:
  command: pytest -q
  watch:
    - pytest -q

logs:
  sources:
    - docker logs my-app
```

## Environment Variables

- `OPTIDEV_HOME` — override state root directory
- `OPTIDEV_PROJECTS_DIR` — override projects root
- `OPTIDEV_SCAN_PATHS` — colon-separated scan paths
- `OPTIDEV_DISABLE_ZELLIJ=1` — disable zellij process launch
- `OPTIDEV_DISABLE_HOOKS=1` — disable hooks process launch
- `OPTIDEV_PLUGIN_DIR` — plugin directory

Installer-specific:

- `OPTID_GIT_URL` — git URL override (default: `https://github.com/dimkk/optistart`)
- `OPTID_INSTALL_DIR` — clone destination (default `~/.optidev/optistart`)
- `OPTID_BIN_DIR` — CLI link directory (default `~/.local/bin`)

## Plugins
A plugin is a Python file exposing class `Plugin` with methods:

- `on_workspace_start(context)`
- `on_agent_message(message)`
- `on_workspace_stop(context)`

Minimal example:

```python
class Plugin:
    def on_workspace_start(self, context):
        pass

    def on_agent_message(self, message):
        pass

    def on_workspace_stop(self, context):
        pass
```

## Tests

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Current suite status: `42 passed`.

## Release Matrices
Current release: `v1-0`

- `docs/v1-0/features-matrix.md`
- `docs/v1-0/test-matrix.md`

If release is not specified by user, agent auto-bumps minor version (`v1-0 -> v1-1`) and creates missing matrix files.
