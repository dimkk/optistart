# mux-abst-001: Terminal multiplexer abstraction layer

## description
Create a stable abstraction boundary for workspace multiplexing:
- backend contract for start/stop operations
- backend selection layer
- CLI/workspace code depends on abstraction, not concrete backend implementation

MVP backend remains `zellij` only.

## current implementation state
- Added backend selection factory: `optidev/mux/factory.py`.
- App bootstrap now selects backend through abstraction (`create_multiplexer(...)`).
- Workspace lifecycle remains abstraction-driven (`Multiplexer` contract), no direct backend coupling in CLI/app logic.
- Coverage added for unit/integration/e2e abstraction behavior.

## implementation plan
1. Completed: multiplexer factory for backend selection.
2. Completed: app bootstrap wiring via abstraction.
3. Completed: unit tests for backend selection logic.
4. Completed: integration test for abstraction-driven lifecycle.
5. Completed: e2e smoke with explicit mux backend config.
