# Task 027 Report: runtime-ts-002 slice 6

## Implemented behavior
- Added a bounded native plugin/runtime helper layer in `ui/apps/server/src/optidevPlugins.ts`.
- Migrated these remaining embedded runtime actions from daemon fallback into the forked `t3` server path:
  - `stop`
  - `plugin advice`
  - `plugin telegram start|stop|status`
- Native stop now performs:
  - hook shutdown
  - mux shutdown
  - home session status update
  - project-local session stop marking
  - bounded plugin stop event emission for Telegram
- Native startup now also emits bounded plugin start events for Telegram.
- Route dispatch now keeps only unmigrated plugin commands like `skills` and `agents` on bridge fallback.

## Tests added or updated
- Added `ui/apps/server/src/optidevPlugins.test.ts`.
- Updated `ui/apps/server/src/optidevLifecycle.test.ts` to cover native `stop`.
- Updated `ui/apps/server/src/optidevRoute.test.ts` to cover native `stop`, native `plugin advice`, and bridge fallback for unmigrated plugin commands.
- Re-ran colocated server tests, browser `/optidev` tests, and Python compatibility tests.

## Important decisions
- Kept plugin migration bounded to runtime-critical and UI-visible behavior instead of porting network-heavy search/install flows in the same slice.
- Preserved the daemon as fallback for `skills` and `agents`, which are broader integration surfaces and do not block the embedded runtime path.
- Maintained the upstream `t3` testing pattern: colocated module tests, minimal live route tests, and focused browser regression.

## Open loops or known limits
- `skills` and `agents` plugin commands are still daemon-backed.
- Full Python plugin lifecycle parity is not migrated yet.
- The daemon remains as compatibility infrastructure for the still-unported plugin surfaces.
