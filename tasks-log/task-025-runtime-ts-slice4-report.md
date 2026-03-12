# Task 025 Report: runtime-ts-002 slice 4

## Implemented behavior
- Added a native TypeScript lifecycle cleanup module in `ui/apps/server/src/optidevLifecycle.ts`.
- Migrated `reset` from the Python daemon into the forked `t3` server for the embedded UI/runtime path.
- Native `reset` now performs the same low-risk cleanup stages as the Python path:
  - stop running hook process groups recorded in `hooks.json`
  - stop the mux session for `zellij` or `textual`
  - mark the active home-session state as stopped
  - remove project-local `.optidev/session.json`
  - remove the home session directory for the project
- Route dispatch in `ui/apps/server/src/optidevRoute.ts` now uses the native reset path before falling back to the daemon.

## Tests added or updated
- Added `ui/apps/server/src/optidevLifecycle.test.ts`.
- Updated `ui/apps/server/src/optidevRoute.test.ts` to cover native `reset`.
- Re-ran colocated server tests, browser `/optidev` tests, and Python compatibility tests.

## Important decisions
- Left `stop` daemon-backed for now because the Python `stop` path also triggers plugin stop hooks; migrating that separately avoids splitting plugin lifecycle behavior across runtimes.
- Moved `reset` first because it already has a bounded cleanup contract and no plugin stop callback dependency.
- Kept the same upstream `t3` testing pattern: colocated module tests, minimal live route integration, then browser regression.

## Open loops or known limits
- Runtime start/resume/go/stop are still daemon-backed.
- Plugin runtime integrations are still daemon-backed.
- Full session transition parity for startup/bootstrap flows is still pending.
