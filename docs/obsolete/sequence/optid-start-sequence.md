# OptiDev Start Sequence

This document describes what actually happens when `optid start <project>` or `optid start .` runs.

## Scope

Commands covered:
- `optid start <project>`
- `optid start .`
- `optid resume <project>` / `optid resume .` use the same runtime path, but force `restore`

## High-level flow

```text
CLI
-> resolve project
-> load config + manifest
-> decide bootstrap vs restore
-> ingest project memory
-> run startup plugins
-> write startup artifacts
-> generate zellij layout
-> start or restore workspace session
-> start hooks
-> persist runner/session artifacts
-> print attach command
```

## 1. CLI entry

Entry point:
- `optidev/cli.py`

What happens:
- parse `start` / `resume`
- resolve target project name or current directory
- call into `OptiDevApp.start_project(...)` or `OptiDevApp.start_current_directory(...)`

Files read:
- `~/.optidev/config.yaml` if present

## 2. Project resolution

For `optid start <project>`:
- project is resolved via discovery/registry/scan paths

For `optid start .`:
- current working directory is used directly

Files and locations involved:
- `~/.optidev/projects/` symlink registry if used
- configured scan paths from `~/.optidev/config.yaml`

## 3. Project config and manifest

Main app path:
- `optidev/app.py::_start_resolved_project(...)`

Files read:
- `<project>/.project/config.yaml`
- `<project>/.optidev/workspace.yaml`

If manifest is missing:
- OptiDev creates `<project>/.optidev/workspace.yaml`
- initial values are derived from project config, local agents, and git state

Files written if missing:
- `<project>/.optidev/workspace.yaml`

Manifest is the desired state.

## 4. Project-local runtime session

Files read:
- `<project>/.optidev/session.json`

This file is the project-local last known runtime state.

It is used to decide:
- `bootstrap`
- `restore`
- `missing` for forced resume when incompatible

## 5. Runtime mode decision

Decision engine:
- `optidev/runtime_reconcile.py`

Inputs:
- manifest fingerprint from `<project>/.optidev/workspace.yaml`
- existing `<project>/.optidev/session.json`
- whether command was `start` or forced `resume`

Outputs:
- `bootstrap`
- `restore`
- `missing`

## 6. Runner and agent resolution

Files read:
- manifest agent declarations from `<project>/.optidev/workspace.yaml`
- local agent definitions from `<project>/.agents/agents/`

Decisions made:
- primary runner name
- active/declared agents list

No runtime files written yet.

## 7. Project memory ingestion

Before workspace startup, OptiDev rebuilds structured project memory.

Files read:
- `docs/tasks/*.md`
- `docs/features/**/*.md`
- `docs/releases/*.md`
- `docs/v*/features-matrix.md`
- `tasks-log/task-*-report.md`
- fallback: `tasks/task-*-report.md` for older repos
- `<project>/.optidev/session.json`

Files written:
- `~/.optidev/memory.sqlite`

What gets updated in SQLite:
- tasks
- features
- releases
- decisions
- open loops
- runtime sessions
- agents

## 8. Session directory creation

Per-project session directory:
- `~/.optidev/sessions/<project>/`

This directory is the generated runtime artifact area for the current start.

Files later created here:
- `startup-prompt.txt`
- `optid-context.md`
- `logs-command.sh`
- `tests-command.sh`
- `layout.kdl`
- `runner.json`
- `agents.json`
- `hooks.json` if hooks are started
- `session.json` for global session state

## 9. Startup plugin preparation

Plugin aggregator:
- `optidev/plugin_manager.py::prepare_workspace_start(...)`

Current built-in startup participants:
- workspace bootstrap plugin
- advice plugin when `--advice` is enabled

### 9.1 Workspace bootstrap plugin

Files written:
- `~/.optidev/sessions/<project>/logs-command.sh`
- `~/.optidev/sessions/<project>/tests-command.sh`
- `~/.optidev/sessions/<project>/optid-context.md`

How defaults are chosen:
- logs command from manifest service/log command, else `.project/config.yaml -> dev.start[0]`
- tests command from manifest tests command, else `.project/config.yaml -> tests.watch[0]` or `tests.command`

`optid-context.md` contains:
- runtime paths
- manifest state
- project memory summary
- local/global skills inventory
- local/global agents inventory
- recent sessions/messages from `~/.optidev/memory.sqlite`

### 9.2 Advice plugin

If `--advice` was passed:
- repo advice prompt is generated and appended to startup prompts

Files read during advice generation may include repo manifests like:
- `package.json`
- `pyproject.toml`
- other detectable stack files

## 10. Startup prompt materialization

All startup prompt fragments from plugins are merged and written to:
- `~/.optidev/sessions/<project>/startup-prompt.txt`

This file is later passed to the chat pane runtime.

## 11. Layout generation

OptiDev resolves a layout spec into zellij KDL.

File written:
- `~/.optidev/sessions/<project>/layout.kdl`

Current default tabs are plugin-driven:
- `Chat`
- `Editor`
- `Logs`
- `Tests`

Pane behavior:
- `Chat` -> `python -m optidev.chat_bridge ...`
- `Editor` -> `python -m optidev.pane_runtime exec -- fresh .`
- `Logs` -> `python -m optidev.pane_runtime watch-file --command-file logs-command.sh`
- `Tests` -> `python -m optidev.pane_runtime watch-file --command-file tests-command.sh`

## 12. Workspace session start/restore

Workspace service:
- `optidev/workspace.py`

Files written:
- `~/.optidev/sessions/<project>/session.json`
- `~/.optidev/active_session.json`
- `~/.optidev/memory.sqlite` session history rows

Behavior split:

### bootstrap path
- zellij detached session is started
- `layout.kdl` is used to create the workspace
- session state is marked as running

### restore path
- if global session file for the same project is already running, OptiDev marks it as restored
- zellij is not relaunched in that case
- state files are refreshed

## 13. Hooks startup

Hooks runner starts project commands derived from manifest/project config.

Possible file written:
- `~/.optidev/sessions/<project>/hooks.json`

This file tracks running hook processes, typically logs/dev sources.

## 14. Runner bootstrap metadata

Runner manager writes bootstrap metadata to:
- `~/.optidev/sessions/<project>/runner.json`

Current contents include:
- runner name
- resolved default chat command
- bootstrap timestamp

## 15. Agents runtime artifact

Declared/active agents are persisted to:
- `~/.optidev/sessions/<project>/agents.json`

Each entry includes:
- agent name
- runner
- definition path

## 16. Project-local runtime session update

After workspace state exists, OptiDev writes project-local runtime state to:
- `<project>/.optidev/session.json`

This is the file later used for compatibility checks on future `start` / `resume` calls.

It stores:
- manifest fingerprint
- active task
- branch
- head commit
- agents
- status
- runner
- mux session name
- layout path
- last mode
- timestamps

## 17. Memory update after start

OptiDev records the current runtime session back into:
- `~/.optidev/memory.sqlite`

It also records a system message like workspace start.

This ensures next startup can render:
- project memory
- last completed feature
- open loops
- recent sessions/messages

## 18. Plugin lifecycle events

After startup state is persisted, plugins receive:
- `on_workspace_start(...)`
- `on_agent_message("workspace_started")`

Current example:
- Telegram plugin appends events to `~/.optidev/plugins/telegram-events.jsonl`

## 19. Chat pane runtime after zellij opens

When the `Chat` tab starts, `optidev.chat_bridge` runs.

Files read:
- `~/.optidev/sessions/<project>/startup-prompt.txt` if present
- `~/.optidev/active_session.json`
- `~/.optidev/plugins/telegram-config.json` if Telegram is enabled

What the chat bridge does:
- resolves default runner command from `optidev/runners/`
- starts the runner process in a PTY
- sends startup prompt into the runner if present
- mirrors local terminal input/output
- if Telegram is enabled and this is the active project, mirrors chat traffic both ways

Bridge-local files written:
- `~/.optidev/sessions/<project>/chat-bridge.pid`
- `~/.optidev/sessions/<project>/chat-bridge-state.json` for Telegram update offset

## 20. What the user sees

CLI output includes:
- `OptiDev workspace ready.`
- structured memory digest
- runtime mode (`bootstrap` or `restore`)
- active task if any
- declared agents if any
- hook count if any
- runner ready line
- attach command: `zellij attach <session>`

If auto-attach is enabled and terminal is interactive:
- OptiDev runs `zellij attach <session>` automatically

## Minimal file map

### Project-local state
- `<project>/.project/config.yaml`
- `<project>/.optidev/workspace.yaml`
- `<project>/.optidev/session.json`

### Global OptiDev state
- `~/.optidev/config.yaml`
- `~/.optidev/active_session.json`
- `~/.optidev/memory.sqlite`
- `~/.optidev/plugins/telegram-config.json`

### Per-session generated artifacts
- `~/.optidev/sessions/<project>/session.json`
- `~/.optidev/sessions/<project>/layout.kdl`
- `~/.optidev/sessions/<project>/startup-prompt.txt`
- `~/.optidev/sessions/<project>/optid-context.md`
- `~/.optidev/sessions/<project>/logs-command.sh`
- `~/.optidev/sessions/<project>/tests-command.sh`
- `~/.optidev/sessions/<project>/runner.json`
- `~/.optidev/sessions/<project>/agents.json`
- `~/.optidev/sessions/<project>/hooks.json`
- `~/.optidev/sessions/<project>/chat-bridge.pid`
- `~/.optidev/sessions/<project>/chat-bridge-state.json`

## Important caveat

If the workspace is restored from an already running global session:
- generated startup prompts may still be written
- but the already-running chat pane will not automatically replay a newly generated advice prompt
- CLI warns about this case when `--advice` was requested during restore
