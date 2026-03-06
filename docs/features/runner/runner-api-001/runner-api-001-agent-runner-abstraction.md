# runner-api-001: Agent runner abstraction

## description
Introduce a unified runner API with MVP adapters:
- `codex` adapter scaffold
- `claude` adapter scaffold
- config-based runner selection
- bootstrap integration during workspace start

## current implementation state
- Runner API implemented under `optidev/runners/`.
- `codex` and `claude` adapters added as MVP scaffolds.
- Runner factory + manager added for config-based selection and bootstrap lifecycle.
- Startup flow now triggers runner bootstrap and persists `runner.json` per session.
- CLI start output includes runner readiness line.

## implementation plan
1. Completed: base runner protocol and bootstrap model.
2. Completed: `codex` and `claude` adapter scaffolds.
3. Completed: runner factory and manager.
4. Completed: app startup integrated with runner bootstrap.
5. Completed: unit/integration/e2e contract and selection tests.
