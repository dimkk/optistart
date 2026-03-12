# Task 029 Runtime TS Native-Only Report

## implemented behavior
- Removed the embedded OptiDev Python bridge from the forked `t3` server runtime.
- Added `ui/apps/server/src/optidevContract.ts` so the embedded route uses native TS action/context contracts without importing the old bridge layer.
- Reworked `ui/apps/server/src/optidevRoute.ts` to be native-only:
  - no `bridge.dispatch(...)`
  - no compatibility daemon fallback
  - unsupported actions now return explicit native errors
- Reworked `ui/apps/server/src/optidevStartup.ts` so workspace panes are generated as session-local shell scripts instead of `python -m optidev.chat_bridge` and `python -m optidev.pane_runtime`.
- Updated the textual attach hint to point users at `/optidev` in the forked UI instead of a Python TUI entrypoint.
- Removed the bridge-only server artifacts:
  - `ui/apps/server/src/optidevBridge.ts`
  - `ui/apps/server/src/optidevBridge.test.ts`
- Removed the server shutdown dependency on bridge cleanup in `ui/apps/server/src/wsServer.ts`.
- Updated `/optidev` UI copy to say integrations run natively in the forked `t3` runtime.

## tests added or updated
- Updated `ui/apps/server/src/optidevRoute.test.ts` to assert:
  - unsupported OptiDev actions fail explicitly
  - unsupported plugin commands fail explicitly
  - native route actions succeed without bridge semantics
- Updated `ui/apps/server/src/optidevStartup.test.ts` to assert:
  - generated layouts do not contain Python module commands
  - session-local pane shell scripts are written
  - textual attach guidance points to `/optidev`
- Updated `ui/apps/server/src/optidevNative.test.ts` wording to reflect native-only state assembly.

## important decisions
- The embedded `/optidev` route is now treated as a native-only TS/Bun product surface.
- Startup pane behavior preserves session/layout artifacts but switches to generated shell scripts as the lowest-risk replacement for Python helper modules.
- Legacy Python CLI/TUI paths are not part of this embedded runtime contract and should be retired separately if desired.

## open loops or known limits
- The repository still contains legacy Python runtime code outside the embedded `t3` path.
- Generated logs/tests pane scripts run the configured command directly; they no longer provide the old Python file-watching helper behavior.
