# ws-session-001: Workspace session restore/bootstrap

## description
Implement workspace session lifecycle with durable local state:
- create session on first start
- restore session for repeated starts
- maintain active session metadata
- persist session state under `~/.optidev/sessions/<project>/`

## current implementation state
- Session lifecycle now supports explicit restore semantics.
- `WorkspaceService.start()` restores running session state for repeated starts.
- Active session metadata extended (`project`, `status`, `mux_backend`, `mux_session_name`, `updated_at`).
- Session transitions persist deterministically in `session.json`.
- CLI startup reports restored state with `Session restored.` message.

## implementation plan
1. Completed: explicit restore behavior in `WorkspaceService.start()`.
2. Completed: active session metadata extended and persisted.
3. Completed: deterministic status transitions preserved.
4. Completed: lifecycle transition and persistence tests added.
5. Completed: e2e restart/restore smoke test added.
