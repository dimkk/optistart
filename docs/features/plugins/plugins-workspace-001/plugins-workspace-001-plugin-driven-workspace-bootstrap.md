# plugins-workspace-001: Plugin-driven workspace bootstrap

## Description

Move the default OptiDev workspace startup flow out of hardcoded core logic and into a built-in startup plugin that owns:
- workspace tab set
- tab names and positions
- pane purposes
- editor bootstrap command
- logs/tests bootstrap runtime
- runner bootstrap context delivered to Codex

The plugin must define the initial layout through `layout_spec`, while the app resolves system-owned runtime commands such as the chat bridge.

## Current implementation state

- Completed in current release:
  - app now resolves plugin-provided `layout_spec` into the mux layer
  - built-in workspace bootstrap plugin owns the default workspace tabs
  - editor pane launches `fresh .` through a resilient pane runtime
  - logs/tests panes watch session command files
  - startup creates `optid-context.md`, `logs-command.sh`, and `tests-command.sh`
  - Codex startup prompt now explicitly references memory, skills, agents, and command-file responsibilities
  - `--advice` remains layered as a separate startup plugin on top of the workspace bootstrap prompt

## Implementation plan

1. Completed: `layout_spec` is the startup contract between app and plugins.
2. Completed: built-in workspace bootstrap plugin returns the default layout with tabs:
   - Chat
   - Editor
   - Logs
   - Tests
3. Completed: `fresh .` launches in the editor tab through `optidev.pane_runtime`.
4. Completed: logs/tests tabs use file-watching pane runtimes so Codex can materialize the correct commands after inspecting the repository.
5. Completed: OptiDev session context artifact summarizes recent memory, installed skills/agents, and command-file paths.
6. Completed: startup prompt tells Codex how to operate inside OptiDev and what to do first.
7. Completed: `--advice` remains a separate startup plugin layered on top of this bootstrap flow.
8. Completed: unit, integration, and e2e coverage added for layout generation, context artifact generation, startup prompt generation, and command-file driven panes.
