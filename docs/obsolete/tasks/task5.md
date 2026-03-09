# Task 5

## goal
Add a working terminal UI backend built on a real framework while keeping the existing backend abstraction intact so OptiDev can run with either `zellij` or an in-process `textual` workspace.

## architecture
- Keep the current `mux` layer as the runtime-backend seam instead of deleting it.
- Add a second backend, `textual`, beside `zellij`.
- Reuse the existing backend-agnostic `layout_spec` tree as the source of truth for pane/tab structure.
- Let `zellij` remain the detached attachable backend.
- Let `textual` run as a foreground UI launched from the CLI attach path, with session metadata still persisted through the existing workspace/session services.
- Preserve current persisted session fields for now to avoid a broad schema migration; interpret them as runtime backend metadata rather than strictly external mux state.

## atomic features
- `mux-textual-001`:
  Add a `Textual`-based runtime backend selectable through config/factory while preserving `zellij`.

## test plan
- Unit:
  Validate config acceptance, backend factory selection, textual layout payload generation, and CLI attach behavior branching.
- Integration:
  Validate workspace/session persistence with the textual backend metadata and stop behavior.
- E2E:
  Validate CLI startup/status with `mux_backend: textual` in non-interactive mode, and layout payload generation for the textual runtime.

## approvals / notes
- User explicitly requested trying a real TUI framework and then clarified that we should not fully remove the mux/backend layer.
- `Textual` is the chosen framework.
- Scope for this cycle is a safe dual-backend rollout, not a full session-schema rename away from `mux_*` fields.
