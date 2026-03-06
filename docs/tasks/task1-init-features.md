# Task 1 Atomic Feature Breakdown (MVP)

## Release target
- Release: `v1-0` (MVP baseline)

## Atomic features

### 1. `cli-core-001` — Core CLI command surface
- Provide commands: `optid <project>`, `stop`, `status`, `logs`, `projects`.
- Validate arguments and output deterministic user-facing messages.

### 2. `prj-discovery-001` — Project discovery
- Discover projects from:
  - configured path (`~/.optidev/projects` by default)
  - optional scan paths (`~/dev`, `~/projects`)
- Resolve target project by name.

### 3. `cfg-load-001` — Config loading and validation
- Load global config and project config.
- Validate schema and defaults.

### 4. `ws-session-001` — Workspace session restore/bootstrap
- Create or restore session state per project.
- Maintain active session metadata.

### 5. `mux-abst-001` — Terminal multiplexer abstraction layer
- Define backend-agnostic interface for workspace pane/session lifecycle.
- Wire MVP to `zellij` through this interface.

### 6. `mux-zellij-001` — Zellij backend adapter
- Generate `layout.kdl` and start named Zellij session through mux interface.
- Keep Zellij behavior behind abstraction boundary.

### 7. `runner-api-001` — Agent runner abstraction
- Define unified runner interface.
- Implement codex adapter scaffold.
- Add claude adapter scaffold.

### 8. `memory-sql-001` — SQLite memory persistence
- Create DB and schema for sessions/messages/tasks/decisions.
- Provide read/write API used by workspace flow.

### 9. `hooks-dev-001` — Dev/test/log hooks execution
- Execute configured commands for dev startup and test/log panes.
- Capture process handles and lifecycle metadata.

### 10. `plugins-core-001` — Minimal plugin lifecycle
- Load plugins from `optidev/plugins/`.
- Call hooks on workspace start/message/stop.

### 11. `status-obsv-001` — Status and logs observability
- Implement `optid status` and `optid logs` behavior against runtime state.

## Sequencing constraints
- Start order for implementation:
  1. `cli-core-001`
  2. `prj-discovery-001`
  3. `cfg-load-001`
  4. `ws-session-001`
  5. `mux-abst-001`
  6. `mux-zellij-001`
  7. `runner-api-001`
  8. `memory-sql-001`
  9. `hooks-dev-001`
  10. `plugins-core-001`
  11. `status-obsv-001`

## Human approval needed
- This feature list requires approval before starting atomic implementation lifecycle.
