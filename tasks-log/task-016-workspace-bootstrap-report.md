# Task 016 Report: Plugin-driven workspace bootstrap

## Scope

Implemented `plugins-workspace-001` in `v1-0`.

## What changed

- Completed `layout_spec` handoff from startup plugins through app/workspace/mux.
- Added built-in plugin `optidev/plugins/workspace_bootstrap.py`.
- Default workspace is now plugin-owned with tabs:
  - Chat
  - Editor
  - Logs
  - Tests
- Editor pane launches `fresh .` through `optidev.pane_runtime exec`.
- Logs/tests panes launch `optidev.pane_runtime watch-file` against session command files.
- Startup now generates session artifacts:
  - `optid-context.md`
  - `logs-command.sh`
  - `tests-command.sh`
- Codex startup prompt now explicitly references:
  - OptiDev runtime context
  - memory snapshot
  - installed skills
  - installed agents
  - required command discovery for logs/tests
- `init` now creates `.agents/agents`, `.agents/skills`, and `.agents/mcp` for new projects.

## Validation

- Added unit coverage for workspace bootstrap plugin output and artifact generation.
- Added e2e coverage for plugin-owned layout generation and command-file seeding.
- Full repository test suite passes after the change.

## Notes

- Advice remains a separate startup plugin and layers on top of the workspace bootstrap prompt.
- Plugin developers now have an explicit place to replace layout, editor command, and startup artifact strategy without changing core CLI/session orchestration.
