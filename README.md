# OptiDev (`optid`)

A local CLI workspace orchestrator for AI coding sessions.

Fast install:

```bash
curl -fsSL https://raw.githubusercontent.com/dimkk/optistart/main/scripts/install.sh | bash
```

```powershell
irm https://raw.githubusercontent.com/dimkk/optistart/main/scripts/install.ps1 | iex
```

Main flows:

- `optid` starts the shipped `t3code` + OptiDev UI bundle
- `optid start <project>` bootstraps or restores an OptiDev workspace for a repository
- `optid t3code refresh --dry-run --allow-dirty` shows how the vendored upstream refresh would replay onto the current `./ui/`
- pull requests targeting `main` run the repository-owned validation suite before merge
- pushes to `test` run validation, bump the nightly version, package a compact JS runtime bundle, and publish a prerelease
- pushes to `main` run validation, bump the stable version, package a compact JS runtime bundle, and publish a stable release

## Current Status
MVP is implemented and tested.

Available commands:

- `optid` (start the bundled `t3code` + OptiDev UI)
- `optid ui` (same as `optid`)
- `optid --version`
- `optid t3code [status|bootstrap|refresh]`
- `optid runner ls`
- `optid runner resume <id>`
- `optid start <project> [--no-advice]`
- `optid start [--no-advice]` (from current project directory)
- `optid init <name|.>`
- `optid go <name|.> [--no-advice]` (init + start in one command)
- `optid resume [project|.]`
- `optid reset [project|.]`
- `optid workspace clone <name>`
- `optid stop`
- `optid status`
- `optid logs`
- `optid projects`
- `optid telegram [start --token <token> --chat-id <chat-id>|stop|status]`
- `optid skills [search|install]`
- `optid agents [search|install]`
- `optid advice` (print repo summary for current directory)

Implemented subsystems:

- manifest-first workspace runtime via `.optidev/workspace.yaml`
- project-local session store via `.optidev/session.json`
- terminal runtime backend abstraction (`zellij` and `textual`)
- runner abstraction (`codex`, `claude`)
- project discovery
- global + project config loading/validation
- workspace session bootstrap + restore
- SQLite memory store (`~/.optidev/memory.sqlite`)
- structured memory graph for tasks, features, releases, decisions, open loops, sessions, and agents
- dev/tests/log hooks execution
- plugin lifecycle (`start`, `message`, `stop`)
- native Bun CLI and forked `t3` runtime sharing one TS/Bun workspace core
- plugin startup augmentation for default startup advice and related bootstrap features
- plugin-driven workspace bootstrap with tabs for chat, editor, logs, and tests
- upstream `t3code` fork embedded under `./ui/`, with OptiDev wired into the forked web/server runtime

## Prerequisites
Before installation:

- `bash`
- `node` `24+` (required)
- `npm` (required for stable/tagged release install)
- `curl` (required for `curl | bash` install flow)
- `tar` (required for Unix release install extraction)
- `bun` `1.3+` (required only for local-repo installs and branch snapshot/nightly source builds)
- `zellij` (optional runtime backend)
- `fresh` editor CLI (recommended for the editor tab)
- `Codex` CLI (primary recommended agent runner)
- `Claude Code` CLI (optional; supported by runner selection)
- `OpenCode`, `Aider`, etc. (planned/upcoming)

Suggested installs:

```bash
npm install -g @fresh-editor/fresh-editor
```

## Installation

### Local repo already present
If you are in the project root (contains `scripts/optid` and `ui/apps/server/`), run:

```bash
./scripts/install.sh
```

This installs/updates the CLI shim to `~/.local/bin/optid` and ensures PATH export in your shell rc.
After install, the script prints the exact `source ...` command(s) for your shell profile.

If you want PATH to be available immediately in the current shell session:

```bash
source ./scripts/install.sh
```

PATH profile behavior:

- macOS + `bash`: `~/.bash_profile`
- `zsh`: `~/.zshrc` and `~/.zprofile`
- other shells: `~/.profile`

### Remote install via curl
Default install command:

```bash
curl -fsSL https://raw.githubusercontent.com/dimkk/optistart/main/scripts/install.sh | bash
```

### Remote install via PowerShell

```powershell
irm https://raw.githubusercontent.com/dimkk/optistart/main/scripts/install.ps1 | iex
```

### Nightly install from `test`

Use this path when you want the current pre-release branch state instead of the stable/tagged install flow from `main`.

Remote one-liners:

```bash
curl -fsSL https://raw.githubusercontent.com/dimkk/optistart/test/scripts/install.sh | bash
```

```powershell
$env:OPTID_GIT_REF='test'
irm https://raw.githubusercontent.com/dimkk/optistart/test/scripts/install.ps1 | iex
```

Unix/macOS:

```bash
git clone --branch test https://github.com/dimkk/optistart.git
cd optistart
./scripts/install.sh
```

Windows PowerShell:

```powershell
git clone --branch test https://github.com/dimkk/optistart.git
cd optistart
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

Update an existing nightly checkout:

```bash
git checkout test
git pull origin test
./scripts/install.sh
```

```powershell
git checkout test
git pull origin test
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

How it works:

- stable remote install with no extra env vars still resolves the tagged release flow from `main`
- nightly remote install should set `OPTID_GIT_REF=test`, so the installer resolves both the manifest and the branch snapshot from `origin/test` instead of the stable/tagged `main` flow
- local-repo install still works the same way after a `git clone --branch test`
- Windows installer also adds `%LOCALAPPDATA%\optid\bin` to the current session and user `PATH`, so `optid` should be available in new shells without manual PATH editing

Optional override (for fork/private mirror):

```bash
curl -fsSL https://raw.githubusercontent.com/dimkk/optistart/main/scripts/install.sh | OPTID_MANIFEST_URL=<YOUR_MANIFEST_URL> bash
```

Installer behavior:

1. If local repo layout is detected, it uses local files only.
2. If local repo is not detected, it resolves release metadata from `scripts/release-manifest.json` on `main` by default, or from the branch selected through `OPTID_GIT_REF` for nightly/test installs.
3. Stable/tagged installs download a compact prebuilt runtime tarball for that version into `~/.optidev/optistart/releases/` and install production server dependencies with `npm`.
4. Branch snapshot installs still download the branch source tree and build the runtime locally with Bun.
5. It exposes a stable `optid` launcher and adds PATH export automatically.

## T3 Fork UI

The repository vendors upstream `t3code` under `./ui/` and integrates OptiDev into that fork instead of shipping a separate web shell.

Install and build the fork:

```bash
cd ui
bun install --ignore-scripts
bun run build
```

Then start the built forked `t3` server from the vendored workspace:

```bash
optid
```

The forked server handles `/api/optidev/*` natively inside the `TS/Bun` runtime. Workspace state, memory, startup, lifecycle, and embedded plugin actions no longer depend on a Python bridge on the browser path.

The integrated route is available at:

```text
http://127.0.0.1:3773/optidev
```

The forked OptiDev route exposes:

- discovered projects with resolved paths
- read/save/impact preview for `.optidev/workspace.yaml`
- runtime actions (`init`, `start`, `go`, `resume`, `reset`, `stop`)
- workspace clone
- memory digest, open loops, typed lookups, and a structured memory graph payload
- status and logs
- repository file browsing with the shared t3 markdown renderer
- native plugin inventory plus plugin-backed integrations including advice, Telegram, skills, and agents

## Quick Start

Stable install:

```bash
curl -fsSL https://raw.githubusercontent.com/dimkk/optistart/main/scripts/install.sh | bash
```

Then verify the install and open the UI:

```bash
optid --version
optid
```

Start in the current directory:

```bash
optid start
```

Start from an empty folder:

```bash
mkdir demo
cd demo
optid start
```

Useful next commands:

```bash
optid status
optid runner ls
optid workspace clone feature-x
optid logs
optid stop
```

Telegram is not part of the zero-config quick start. It needs explicit credentials:

```bash
optid telegram start --token <token> --chat-id <chat-id>
```

`optid start` and `optid go` enable startup advice by default. Use `--no-advice` when you want a quieter bootstrap.

If your shell has not reloaded PATH yet, use:

```bash
~/.local/bin/optid
```

Installed release launch behavior:

- `optid` starts the bundled `t3code` + OptiDev UI
- `optid ui` is an explicit alias for the same bundled UI launch
- `optid t3code ...` exposes vendored upstream maintenance without calling internal script paths directly
- installed releases run native commands through the bundled Node CLI runtime
- local repo and branch snapshot installs still delegate native commands through the Bun source CLI runtime
- installed releases check the latest remote tag and print an upgrade suggestion when a newer release exists

## Workspace Manifest

OptiDev v1-1 is manifest-first.

Primary workspace files inside the repository:

- `.optidev/workspace.yaml` — desired workspace state
- `.optidev/session.json` — last known live runtime state

Manifest tracks:

- project name
- active task
- git branch
- last known HEAD commit
- active agents
- tab/layout intent
- services
- tests
- logs
- context roots for agents/skills/MCP

Git rule:

- manifest stores the current branch and current HEAD commit
- branch history belongs in session history or memory, not in the manifest itself

If a manifest is missing, OptiDev bootstraps one from the current repository and legacy `.project/config.yaml`.

## Workspace Runtime

Default workspace startup is manifest-driven, with plugins extending the resolved runtime.

When you run `optid start ...` or `optid go ...`, OptiDev resolves a backend-agnostic workspace layout with tabs:

- `Chat` — launches a generated shell script that prints the startup prompt and starts the selected runner
- `Editor` — launches `fresh .` in the project directory
- `Logs` — runs the current command from `sessions/<project>/logs-command.sh`
- `Tests` — runs the current command from `sessions/<project>/tests-command.sh`

If `fresh` is not installed, the editor pane falls back to plain `bash`.

Runtime backends:

- `mux_backend: zellij` writes `layout.kdl` and uses external attach/kill session behavior.
- `mux_backend: textual` writes `layout.textual.json` and points users back to `/optidev` in the forked UI.

Startup also generates session artifacts:

- `sessions/<project>/optid-context.md`
- `sessions/<project>/logs-command.sh`
- `sessions/<project>/tests-command.sh`
- `sessions/<project>/agents.json`

The chat runner is instructed to:

1. read the generated OptiDev context first
2. inspect memory, skills, and agents from that context
3. discover or confirm app/test commands
4. write those commands into the logs/tests command files

If project config already provides commands, OptiDev seeds the command files automatically:

- `dev.start[0]` seeds `logs-command.sh`
- `tests.watch[0]` or `tests.command` seeds `tests-command.sh`

Lifecycle commands:

- `optid start` — bootstrap or restore, depending on manifest/session compatibility
- `optid resume` — require compatible manifest/session and restore
- `optid reset` — drop project-local session state and clear runtime session artifacts
- `optid workspace clone <name>` — derive a branch workspace manifest under `.optidev/workspaces/<name>/`

## Structured Memory

OptiDev `v1-2` adds structured project memory on top of session/chat history.

Available commands:

- `optid memory`
- `optid memory show feature <id>`
- `optid memory show task <id>`
- `optid memory show release <id>`
- `optid memory open-loops`

Memory graph sources:

- `docs/tasks/*.md`
- `docs/features/**/*.md`
- `docs/releases/*.md`
- `docs/v*/features-matrix.md`
- `tasks-log/task-*-report.md`
- `.optidev/session.json`

Startup and resume now render a compact digest with:

- current release
- active feature
- last completed feature
- open loops
- key decisions
- next suggested action

## Data Layout
Default state root: `~/.optidev`

- `config.yaml` — global config
- `memory.sqlite` — persisted memory
- `active_session.json` — active session pointer
- `sessions/<project>/session.json` — session state
- `sessions/<project>/layout.kdl` — generated zellij layout
- `sessions/<project>/layout.textual.json` — generated textual runtime payload
- `sessions/<project>/runner.json` — runner bootstrap metadata
- `sessions/<project>/hooks.json` — hook process metadata
- `plugins/telegram-config.json` — saved Telegram bridge configuration

Project-local runtime state:

- `.optidev/workspace.yaml` — desired manifest
- `.optidev/session.json` — project-local runtime session
- `.optidev/workspaces/<name>/workspace.yaml` — cloned branch manifest

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
- `mux_backend`: `zellij | textual`
- `telegram_bot_token`: default Telegram bot token for `optid telegram start`
- `telegram_chat_id`: default Telegram chat id for `optid telegram start`

Example:

```yaml
default_runner: codex
workspace_layout: default
projects_path: ~/.optidev/projects
scan_paths:
  - ~/dev
  - ~/projects
mux_backend: zellij
telegram_bot_token: 123456:ABCDEF
telegram_chat_id: 123456789
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
- `OPTIDEV_DISABLE_ZELLIJ=1` — disable zellij process launch when using the `zellij` backend
- `OPTIDEV_AUTO_ATTACH=0` — disable automatic backend attach/UI launch on `start/go`
- `OPTIDEV_DISABLE_HOOKS=1` — disable hooks process launch
- `OPTIDEV_PLUGIN_DIR` — plugin directory
- `OPTIDEV_TELEGRAM_BOT_TOKEN` — optional emergency override; global config is preferred
- `OPTIDEV_TELEGRAM_CHAT_ID` — optional emergency override; global config is preferred

Installer-specific:

- `OPTID_GIT_URL` — git URL override (default: `https://github.com/dimkk/optistart`)
- `OPTID_INSTALL_DIR` — clone destination (default `~/.optidev/optistart`)
- `OPTID_BIN_DIR` — CLI link directory (default `~/.local/bin`)

## Integrations
The shipped OptiDev product now exposes built-in native integrations from the TS/Bun runtime instead of a separate Python plugin API.

Current native integrations:

- `optid advice` and the default startup advice injected by `optid start/go`
- `optid telegram start|stop|status` for Telegram lifecycle mirroring
- `optid skills search|install` for project-local skill discovery under `.agents/skills`
- `optid agents search|install` for project-local agent discovery under `.agents/agents`

Project-specific automation assets still live in:

- `.agents/agents/`
- `.agents/skills/`
- `.agents/mcp/`

## Telegram Bridge

Enable Telegram mirroring:

```bash
optid telegram start --token <token> --chat-id <chat-id>
```

Or store defaults once in `~/.optidev/config.yaml` and then use:

```bash
optid telegram start
```

Disable it:

```bash
optid telegram stop
```

Check current state:

```bash
optid telegram status
```

Behavior:

- Telegram state is stored in `~/.optidev/plugins/telegram-config.json`
- workspace lifecycle events are appended to `~/.optidev/plugins/telegram-events.jsonl`
- the active running workspace remains the only Telegram-connected workspace
- `optid telegram start` without an explicit session pin clears any stale saved target and returns the bridge to auto-target mode
- an explicit UI-triggered start may pin Telegram to a concrete chat session; otherwise the bridge resolves the best available active session at runtime
- start/stop/status are available from both the Bun CLI and the embedded `/optidev` UI

Telegram commands inside chat:

- `/help`
- `/esc`
- `/ctrlc`
- `/enter`
- `/status`
- `/stop`

How to get credentials:

1. Create a bot with `@BotFather` and copy the HTTP API token.
2. Open a private chat with the bot and send any message.
3. Get your chat id:
   - easiest: forward a message to `@userinfobot`, or
   - call `https://api.telegram.org/bot<token>/getUpdates` after sending a message and read `message.chat.id`.

Notes:

- best experience is with `Codex` because the `chat` pane uses `codex --no-alt-screen` by default
- if Telegram is enabled before `optid start`, the bridge attaches automatically when the workspace starts
- `optid init` is idempotent; if the project is already initialized, it does not rewrite the structure

## Advice Mode

Default behavior:

```bash
optid start <project>
```

or:

```bash
optid go <project>
```

Opt out when you want a quieter bootstrap:

```bash
optid start <project> --no-advice
```

Behavior:

- the advice plugin adds a repo-analysis prompt before the main workspace bootstrap prompt
- the generated chat pane script prints the combined startup prompt before launching the runner
- the runner is instructed to inspect the repo, suggest useful skills and agents, then continue with workspace bootstrap duties

## Tests

```bash
bash scripts/run-main-pr-checks.sh
```

`scripts/run-main-pr-checks.sh` is the shared validation surface used by pull requests targeting `main` and by release bump automation after merge.

## Guide

- [`OptiDev UI Guide`](docs/guides/optidev-ui-guide.md)

Historical or superseded documentation lives under `docs/obsolete/`. Active contributor guidance stays in the live `docs/` tree.

## Release Matrices
Current release: `v1-2`

- `docs/v1-2/features-matrix.md`
- `docs/v1-2/test-matrix.md`
- `docs/tasks/task7.md`
- `docs/tasks/task8.md`
- `docs/tasks/task9.md`

If release is not specified by user, keep appending to the current user-approved release and do not auto-bump version.
