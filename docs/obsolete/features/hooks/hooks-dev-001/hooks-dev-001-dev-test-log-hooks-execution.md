# hooks-dev-001: Dev/test/log hooks execution

## description
Execute configured project hooks on workspace lifecycle:
- `dev.start`
- `tests.watch`
- `logs.sources`

Persist hook process metadata and support stop lifecycle handling.

## current implementation state
- Hook runner implemented in `optidev/hooks.py`.
- Startup executes normalized commands from `dev.start`, `tests.watch`, `logs.sources`.
- Hook metadata persisted to `sessions/<project>/hooks.json`.
- Stop lifecycle now attempts graceful shutdown for running hook process groups.
- E2E coverage validates real hook command execution at startup.

## implementation plan
1. Completed: hook runner with normalization + start/stop APIs.
2. Completed: startup integration for configured hooks.
3. Completed: hook metadata persistence in session directory.
4. Completed: stop lifecycle handling for running hook processes.
5. Completed: unit/integration/e2e tests.
