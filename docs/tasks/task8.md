# Task 8

## goal
Retire the dormant Python OptiDev runtime from the repository, keep the shipped product native-only on TS/Bun, and add a screenshot-based operator guide for the current OptiDev feature surface inside the forked `t3` UI.

## architecture
- Treat `ui/apps/server/src/*` and `ui/apps/web/src/routes/optidev.tsx` as the only shipped OptiDev runtime/UI surface.
- Remove the legacy `optidev/*.py` package, Python entrypoints, and Python test suite once all live root/runtime markers and current-release docs stop depending on them.
- Keep `.optidev/*`, `~/.optidev/*`, and the native CLI/UI contracts stable.
- Write the operator guide against the built `/optidev` route and current Bun CLI behavior, using real screenshots from the integrated fork instead of mock wireframes.

## atomic features
- `runtime-ts-003`:
  Remove legacy Python runtime artifacts from the shipped repository path and align current release docs/tests with the native TS/Bun runtime.

## test plan
- Unit:
  Native TS/Bun colocated tests stay authoritative for CLI, state, memory, persistence, startup, lifecycle, and plugin behavior.
- Integration:
  Keep the live HTTP route test and real `scripts/optid` shim test green after Python removal.
- E2E:
  Keep the existing `/optidev` browser suite green and use the built server for screenshot capture against a seeded demo workspace.
- Regression:
  Add or expand TS tests where old Python-only coverage used to be referenced by the current release matrices.

## approvals / notes
- User explicitly requested immediate cleanup of legacy Python and a screenshot instruction set on 2026-03-08.
- Historical reports can remain as history, but current release docs and shipped entrypoints must not describe Python as an active runtime dependency.
- Screenshot capture should use the real built app and real OptiDev state seeded under an isolated `OPTIDEV_HOME`.
