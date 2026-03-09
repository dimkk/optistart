# Task 1 Plugin Extensibility Architecture

## Goal
Keep OptiDev plugin work replaceable at the integration boundaries:

- plugin-owned Telegram transport can be replaced by another messenger plugin
- skills source can be swapped from `skills.sh` / `npx skills` to another catalog
- agents source can be swapped from `aiagentslist.com` to another registry
- startup behaviors such as `--advice` can be added as plugins without hardcoding new branches into the core workspace flow
- workspace layout, pane purposes, and bootstrap flows can be changed by plugin without editing the mux or CLI core

## Architectural decisions

### 1. Plugin manager is the orchestration boundary

Core startup flow stays in `optidev/app.py`, but any plugin can participate through:

- `run_command(...)` for top-level CLI commands
- `prepare_workspace_start(...)` for pre-runner startup augmentation
- lifecycle hooks:
  - `on_workspace_start(...)`
  - `on_agent_message(...)`
  - `on_workspace_stop(...)`

This means new plugins do not need to fork the core CLI parser. They integrate through the plugin manager contract.

### 2. Messenger transport is plugin-owned and separated from the chat bridge

`optidev/chat_bridge.py` owns terminal/PTY orchestration only.

Telegram-specific behavior is delegated through:

- `optidev/plugins/telegram.py`

Current backend:

- `TelegramMessengerClient`

Replacement path for another messenger:

1. implement messenger transport/runtime helpers inside its own plugin module
2. provide its own plugin/config commands
3. wire the chat bridge to that plugin-owned helper if the workspace selects it

The bridge itself does not need to know Telegram details.

### 3. Catalog providers are isolated inside plugin implementations

`skills` and `agents` are command plugins, but each command is split into:

- plugin entrypoint
- provider implementation

Current providers:

- `NpxSkillsProvider` in `optidev/plugins/skills.py`
- `AiAgentsListProvider` in `optidev/plugins/agents.py`

Replacement path:

1. implement a provider with the same `search/install` shape
2. switch the provider selection in the plugin
3. keep CLI surface stable (`optid skills ...`, `optid agents ...`)

This keeps user-facing commands stable while allowing source replacement underneath.

### 4. Advice is a startup plugin, not a core branch

`--advice` is handled as startup context.

Flow:

1. CLI parses `--advice`
2. app passes `advice=true` into plugin startup preparation
3. advice plugin generates startup prompts
4. app writes `startup-prompt.txt`
5. chat bridge injects it into the runner

This makes future startup behaviors extensible:

- architecture review mode
- security audit mode
- onboarding mode
- repo health check mode

without adding new hardcoded startup logic in the core workspace service.

### 5. Workspace layout is plugin-owned

The default workspace is no longer a hardcoded set of panes in `optidev/app.py`.

Instead:

- startup plugins may return `layout_spec`
- `layout_spec` defines:
  - tab set
  - tab names
  - pane positions
  - pane purposes
  - pane commands
- core app resolves only system-owned runtime commands when needed

Current reference implementation:

- `optidev/plugins/workspace_bootstrap.py`

Current default tabs:

- `Chat`
- `Editor`
- `Logs`
- `Tests`

This gives plugin authors one explicit place to replace the default workspace experience.

### 6. Startup context is materialized as artifacts, not just implied by prompts

The core problem with memory/skills/agents is not storage, it is discoverability by the runner.

To make the runner use these capabilities predictably, the workspace bootstrap plugin writes session-local artifacts before startup:

- `optid-context.md`
- `logs-command.sh`
- `tests-command.sh`

`optid-context.md` summarizes:

- recent memory entries
- project-local skills
- global/system skills
- project-local agents
- global agents
- session file locations

Then the startup prompt instructs Codex to:

1. read the context artifact first
2. use relevant skills/agents deliberately
3. inspect repo and materialize logs/tests commands when missing
4. explain what signals were used before feature work

This is the current control point that makes OptiDev capabilities visible to the runner in a repeatable way.

## Integration points developers should use

For new messenger backends:

- implement plugin-owned transport/runtime helpers
- expose plugin configuration/command surface
- integrate the selected helper into chat bridge startup

For new command plugins:

- implement `Plugin.run_command(...)`

For new startup-time behaviors:

- implement `prepare_workspace_start(...)`

For alternative workspace experiences:

- implement `prepare_workspace_start(...)`
- return `layout_spec`
- create any startup artifacts in the session directory
- optionally add startup prompts/messages

For alternative editors:

- replace the `Editor` pane command in the workspace bootstrap plugin

For alternative app/test bootstrap logic:

- replace logs/tests pane commands or the command-file generation strategy in the startup plugin

For new search/install sources:

- add or replace provider class behind the stable plugin command surface

## Why this architecture is acceptable

- CLI surface remains small and stable
- plugin code owns source-specific and transport-specific logic
- workspace bootstrap logic is replaceable without rewriting core startup code
- core app stays focused on session orchestration
- tests can replace provider executables or HTTP endpoints without patching core flow
- future integrations have explicit seams instead of monkeypatch-only extension
