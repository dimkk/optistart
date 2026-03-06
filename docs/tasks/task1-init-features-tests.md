# Task 1 Feature Test Plan (MVP)

## Test levels
- Unit: pure logic and schema validation.
- Integration: file system + process orchestration boundaries.
- E2E: command-line lifecycle scenarios.

## Mapping

### `cli-core-001`
- Unit:
  - command parsing and argument validation.
- Integration:
  - CLI entrypoint wires command handlers correctly.
- E2E:
  - `optid <project>` / `optid status` / `optid stop` baseline flow.

### `prj-discovery-001`
- Unit:
  - path candidate generation.
  - project name matching rules.
- Integration:
  - discovery over temporary directory tree with realistic project folders.
- E2E:
  - `optid projects` includes discovered projects.

### `cfg-load-001`
- Unit:
  - schema defaulting and validation errors.
- Integration:
  - merge global and project config from filesystem.
- E2E:
  - invalid config fails start with actionable message.

### `ws-session-001`
- Unit:
  - session state transitions (new, restored, stopped).
- Integration:
  - persistence in `~/.optidev/sessions/<project>/`.
- E2E:
  - restart flow restores previous session metadata.

### `mux-abst-001`
- Unit:
  - backend selection logic and mux interface contract behavior.
- Integration:
  - workspace lifecycle uses only mux abstraction entrypoints.
- E2E:
  - CLI and workspace code remain mux-backend-agnostic while using zellij backend in MVP.

### `mux-zellij-001`
- Unit:
  - generated `layout.kdl` structure for default pane topology.
- Integration:
  - subprocess invocation contract for Zellij adapter.
- E2E:
  - workspace starts using zellij backend and expected pane layout.

### `runner-api-001`
- Unit:
  - runner interface conformance.
- Integration:
  - adapter selection by config (`codex` / `claude`).
- E2E:
  - runner bootstrap invoked during workspace start.

### `memory-sql-001`
- Unit:
  - schema initialization and CRUD boundaries.
- Integration:
  - SQLite file creation/migration in user state directory.
- E2E:
  - session and message history available after resume.

### `hooks-dev-001`
- Unit:
  - command parsing and hook enable/disable logic.
- Integration:
  - subprocess startup/stop and exit handling.
- E2E:
  - configured dev hooks run on `optid <project>`.

### `plugins-core-001`
- Unit:
  - plugin discovery and interface enforcement.
- Integration:
  - lifecycle callbacks executed in order.
- E2E:
  - sample plugin receives workspace events.

### `status-obsv-001`
- Unit:
  - status representation formatting.
- Integration:
  - log source resolution from active session.
- E2E:
  - `optid status` and `optid logs` match active runtime state.

## Gate
- Optional human approval for this test plan before implementation.
- Mandatory: architecture + features approvals must exist before atomic feature coding begins.
