# Task 2 Feature Test Plan: Workspace Manifest Runtime

## Test levels
- Unit: manifest parsing, decision logic, pure transformations.
- Integration: manifest + session + filesystem + mux/runtime boundaries.
- E2E: CLI lifecycle with manifest-driven bootstrap/restore/clone flows.

## Mapping

### `manifest-schema-001`
- Unit:
  - schema defaults
  - validation errors
  - required/optional field handling
- Integration:
  - manifest file loading from realistic project tree
- E2E:
  - invalid manifest blocks startup with actionable error

### `manifest-load-001`
- Unit:
  - accessor behavior for agents/services/tests/logs/context
- Integration:
  - workspace loader reads `.optidev/workspace.yaml` from project root
- E2E:
  - startup uses manifest-defined project/runtime values instead of defaults

### `session-store-001`
- Unit:
  - session read/write and compatibility metadata
- Integration:
  - session persistence in `<project>/.optidev/session.json`
- E2E:
  - session file is created and updated across lifecycle transitions

### `runtime-reconcile-001`
- Unit:
  - bootstrap vs restore decision matrix
- Integration:
  - manifest/session compatibility influences runtime start path
- E2E:
  - repeated start restores when compatible and bootstraps when incompatible

### `layout-manifest-001`
- Unit:
  - manifest layout to internal layout model transformation
- Integration:
  - mux receives manifest-derived layout spec
- E2E:
  - generated runtime tabs/panes match manifest intent

### `env-manifest-001`
- Unit:
  - service/test/log command selection
- Integration:
  - runtime artifacts and process launch use manifest-defined commands
- E2E:
  - services/tests/logs commands from manifest are materialized and executed correctly

### `agents-manifest-001`
- Unit:
  - agent declaration validation and runner resolution
- Integration:
  - agent manager starts/resumes agents declared by manifest
- E2E:
  - manifest-declared agents are reflected in active runtime/session state

### `context-engine-001`
- Unit:
  - context assembly from memory, repo scan, skills, agents, MCP registry
- Integration:
  - context artifact generation in session/runtime directory
- E2E:
  - runner startup prompt references generated context artifact and command outputs

### `manifest-bootstrap-001`
- Unit:
  - default manifest generation from legacy config inputs
- Integration:
  - migration from `.project/config.yaml` to initial `.optidev/workspace.yaml`
- E2E:
  - first start in legacy repo creates manifest and proceeds successfully

### `workspace-branch-001`
- Unit:
  - branch manifest derivation rules
- Integration:
  - cloned workspace gets isolated manifest/session directories
- E2E:
  - `optid workspace clone <name>` creates isolated branch workspace ready to start

### `cli-runtime-002`
- Unit:
  - command parsing for `resume`, `reset`, `workspace clone`
- Integration:
  - CLI handlers wire to manifest runtime services correctly
- E2E:
  - manifest-native lifecycle commands work end-to-end

### `plugins-runtime-002`
- Unit:
  - plugin startup context includes resolved manifest/runtime metadata
- Integration:
  - plugins run after manifest resolution and receive correct state
- E2E:
  - Telegram/advice/plugin flows still operate under manifest-native startup

## Gate
- Optional human approval for this test plan before implementation.
- Mandatory: architecture + features approvals must exist before atomic feature coding begins.
