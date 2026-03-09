# Task 026 Report: runtime-ts-002 slice 5

## Implemented behavior
- Added a native TypeScript startup orchestration module in `ui/apps/server/src/optidevStartup.ts`.
- Migrated these runtime actions from the Python daemon into the forked `t3` server path:
  - `start`
  - `resume`
  - `go`
- Native startup now handles:
  - manifest ensure/load
  - project-session compatibility checks and runtime-mode selection
  - runner bootstrap persistence in `runner.json`
  - layout generation for `textual` and `zellij`
  - startup prompt/context file generation
  - hook process spawning and `hooks.json` persistence
  - home session state writes and project-local `.optidev/session.json`
  - native `go` chaining through native `init` plus native startup
- Fixed native global config parsing so `mux_backend` is respected by the TS runtime path.

## Tests added or updated
- Added `ui/apps/server/src/optidevStartup.test.ts`.
- Updated `ui/apps/server/src/optidevRoute.test.ts` to cover native `start`, `resume`, and `go`.
- Re-ran colocated server tests, browser `/optidev` tests, and Python compatibility tests.

## Important decisions
- Kept startup plugin parity bounded to the startup-critical behavior instead of migrating the full Python plugin manager wholesale.
- Left `stop` on daemon fallback because plugin stop hooks still live in the Python runtime.
- Preserved the upstream `t3` test style: colocated module tests, minimal live HTTP route tests, and focused browser route regression.

## Open loops or known limits
- `stop` is still daemon-backed.
- Plugin command execution is still daemon-backed.
- Full plugin lifecycle parity is not migrated yet.
