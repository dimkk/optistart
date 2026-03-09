# Task 7

## goal
Plan and execute a staged migration of OptiDev core runtime logic from Python into the vendored upstream `t3code` TypeScript/Bun stack, with a clear target architecture, compatibility boundary, and rollback path.

## architecture
- Treat the forked `t3` server as the long-term primary application host.
- Introduce a TypeScript domain core inside the forked server/runtime layer for:
  - project discovery
  - config + manifest parsing
  - runtime/session state shaping
  - memory read/write orchestration
  - plugin command dispatch contracts
- Migrate by capability slices, not by file-for-file rewrite:
  - slice 1: read-only state and config/manifest loading
  - slice 2: memory read/query surfaces
  - slice 3: project/session persistence
  - slice 4: runtime lifecycle actions (`init`, `start`, `resume`, `reset`, `stop`, clone)
  - slice 5: plugin/runtime integrations
- The embedded `/optidev` route now runs native-only in the forked `t3` server, without a Python compatibility daemon on the browser path.
- The root `optid` CLI shim now also runs on the same native TS/Bun runtime instead of `python -m optidev`.
- Compatibility rules:
  - preserve `.optidev/` workspace and session artifacts until an explicit schema migration is approved
  - preserve existing user-facing CLI semantics where practical
  - preserve testable behavior first, then optimize implementation shape

## atomic features
- `runtime-ts-002`:
  Define and implement the staged TypeScript/Bun migration path for OptiDev runtime/core inside the forked `t3` product.

## test plan
- Unit:
  TS domain services for manifest/config/session/memory/runtime decisions, plus parity tests against current Python behavior.
- Integration:
  Forked `t3` server integration for native-TS actions, Python fallback routing, and persistence compatibility.
- E2E:
  Browser flows in `/optidev` proving that migrated actions behave identically before and after each slice.
- Regression:
  Existing Python CLI tests remain only for the legacy CLI/TUI product path, not for the embedded `t3` runtime.

## test style rules
- Follow upstream `t3` test structure, not a separate OptiDev-only harness.
- Colocate server tests beside migrated modules in `ui/apps/server/src/*.test.ts`.
- Prefer fast `vitest` module tests first, then a minimal live HTTP route test for server integration.
- Keep browser coverage in `ui/apps/web/src/*browser*.tsx` focused on route-level product behavior, not low-level parsing details.
- Each migrated slice should prove:
  - native module behavior in a colocated unit test
  - route behavior in a colocated server integration test
  - stable `/optidev` browser behavior in the existing browser suite

## approvals / notes
- This task is architectural and cross-cutting; implementation should not start until the migration architecture is approved.
- The intended strategy was staged migration rather than a big-bang rewrite; the embedded `t3` runtime has now reached native-only execution for the current `/optidev` surface.
- Current recommended end-state:
  - `t3` owns the product runtime
  - TS/Bun owns primary business logic
  - Python is out of the `/optidev` browser path and limited to legacy non-embedded flows until separately retired
