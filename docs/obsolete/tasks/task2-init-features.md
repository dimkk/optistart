# Task 2 Atomic Feature Breakdown: Workspace Manifest Runtime

## Release target
- Release: `v1-1`

## Architectural intent
Task 2 is manifest-first.

Plugins may extend the runtime, but the base implementation must revolve around:
- workspace manifest
- session state
- bootstrap vs restore
- manifest-driven layout and runtime reconciliation

## Atomic features

### 1. `manifest-schema-001` — Workspace manifest schema and validation
- Define manifest schema for `.optidev/workspace.yaml`.
- Load, validate, and default manifest values.
- Reject malformed manifests with actionable errors.

### 2. `manifest-load-001` — Workspace loader
- Add loader API for reading manifest from project root.
- Expose typed accessors for agents, services, tests, logs, context, and workspace metadata.

### 3. `session-store-001` — Manifest-aware session store
- Add `.optidev/session.json` handling.
- Separate desired manifest state from live runtime session state.
- Track manifest/session compatibility for restore decisions.

### 4. `runtime-reconcile-001` — Bootstrap vs restore decision engine
- Decide whether start flow should bootstrap or restore.
- Use manifest presence, session presence, and compatibility rules.
- Surface deterministic status to CLI and runtime.

### 5. `layout-manifest-001` — Manifest-driven layout generation
- Convert manifest layout intent into mux-agnostic layout model.
- Keep backend rendering inside mux adapter.
- Preserve support for current `zellij` runtime.

### 6. `env-manifest-001` — Manifest-driven services/tests/logs runtime
- Start services from manifest.
- Seed or drive tests/logs from manifest commands.
- Align runtime artifacts with manifest-defined commands.

### 7. `agents-manifest-001` — Manifest-driven agent manager
- Resolve active agents declared by manifest.
- Validate agent definitions exist in configured context path.
- Start/resume/stop/reset declared agents.

### 8. `context-engine-001` — Deterministic startup context engine
- Build startup context from repo scan, manifest context roots, memory, agents, skills, and MCP/tool registry.
- Produce deterministic artifact(s) consumed by the runner.
- Make context usage explicit rather than best-effort.

### 9. `manifest-bootstrap-001` — Initial manifest generation and migration
- If manifest is missing, generate an initial one from current project config and runtime defaults.
- Preserve compatibility with existing `.project/config.yaml` repositories.

### 10. `workspace-branch-001` — Workspace clone/branch runtime
- Add workspace cloning/branching under `.optidev/workspaces/<name>/`.
- Derive new manifest and isolated session state.

### 11. `cli-runtime-002` — Manifest lifecycle CLI
- Extend CLI for manifest-native lifecycle: `start`, `stop`, `resume`, `reset`, `workspace clone`.
- Keep existing core commands working during migration.

### 12. `plugins-runtime-002` — Plugin hooks over manifest runtime
- Re-anchor startup plugin context around manifest/runtime state.
- Ensure Telegram/advice/skills/agents plugins run after manifest resolution.

## Sequencing constraints
Implementation order should be:
1. `manifest-schema-001`
2. `manifest-load-001`
3. `session-store-001`
4. `runtime-reconcile-001`
5. `layout-manifest-001`
6. `env-manifest-001`
7. `agents-manifest-001`
8. `context-engine-001`
9. `manifest-bootstrap-001`
10. `cli-runtime-002`
11. `plugins-runtime-002`
12. `workspace-branch-001`

## Notes
- `workspace-branch-001` is intentionally late because it depends on stable manifest/session semantics.
- Plugin work is downstream of manifest runtime, not upstream of it.
- Current plugin-driven workspace bootstrap should be treated as an implementation detail to be folded under manifest runtime.

## Human approval needed
- This feature list requires approval before starting atomic implementation lifecycle.
