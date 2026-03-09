# Task 020 Report: Textual Runtime Backend

## Implemented behavior
- Added a second runtime backend, `textual`, behind the existing backend abstraction instead of removing the layer.
- `mux_backend` now accepts `zellij` or `textual`.
- Added `optidev/mux/textual.py` to persist a Textual layout payload and support CLI attach/stop behavior.
- Added `optidev/textual_app.py` to render the workspace with `Textual` and run pane commands inside the UI.
- Updated CLI attach behavior so `zellij` keeps external attach semantics while `textual` launches a foreground TUI from the saved layout payload.
- Updated installer/runtime path handling to load vendored Python dependencies from `.vendor/` and prefer `uv` for dependency installation.

## Tests added or updated
- Added `tests/unit/test_textual_mux.py`.
- Updated `tests/unit/test_config.py`, `tests/unit/test_mux_factory.py`, and `tests/unit/test_cli.py`.
- Updated `tests/integration/test_workspace_persistence.py`, `tests/integration/test_mux_abstraction.py`, and `tests/integration/test_zellij_invocation.py`.
- Added textual e2e coverage in `tests/e2e/test_cli_module_entrypoint.py`.

## Important decisions
- Kept the existing `mux` naming and persisted `mux_*` session fields for this cycle to avoid a wider schema migration.
- Treated `textual` as a second runtime backend with different lifecycle semantics instead of forcing it into detached external-session behavior.
- Kept `zellij` fully functional to preserve the previous workflow while adding a fallback UI path.

## Open loops or known limits
- The current Textual UI focuses on a workable terminal runtime fallback; it does not yet provide the same attach/resume model as a detached external multiplexer session.
- Session metadata still uses `mux_*` names even though the backend layer is now broader than only external multiplexers.
