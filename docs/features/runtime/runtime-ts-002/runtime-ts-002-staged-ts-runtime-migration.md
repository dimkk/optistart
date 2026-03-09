# runtime-ts-002: staged TS runtime migration in forked t3

## Summary
Move OptiDev runtime/core behavior into the forked `t3code` TypeScript/Bun stack in staged slices, while preserving `.optidev` compatibility during migration.

## Behavior
- The forked `t3` server becomes the primary application runtime host.
- Read-only OptiDev state surfaces migrate first:
  - config loading
  - project discovery
  - status/logs/state shaping
  - memory summary, open-loop, and typed show queries
- Low-risk persistence actions migrate next:
  - project initialization scaffolding
  - workspace clone manifest generation
- Low-risk lifecycle cleanup migrates before startup orchestration:
  - session reset with mux + hook cleanup
- Startup orchestration then migrates in bounded pieces:
  - native `start`
  - native `resume`
  - native `go`
  - runner bootstrap, layout generation, and session persistence move with that slice
- Runtime stop and bounded plugin actions migrate next:
  - native `stop`
  - native `plugin advice`
  - native `plugin telegram start|stop|status`
- Embedded plugin search/install actions migrate next:
  - native `plugin skills search|install`
  - native `plugin agents search|install`
- The embedded route now executes native-only for the current `/optidev` surface:
  - no Python daemon fallback
  - no per-action bridge dispatch
  - startup panes are generated as native shell scripts in session artifacts

## Notes
- This is an incremental migration contract, not a big-bang rewrite.
- Existing `.optidev` files remain the compatibility boundary until an explicit schema migration is approved.
- The current `/optidev` feature set now runs natively in the forked `t3` server without Python on the hot path.
- The current `/optidev` feature set now runs natively in the forked `t3` server without Python fallback at all.
- Legacy Python CLI/TUI paths are outside this feature boundary and can be retired separately.
- Testing rule:
  migrated slices should use upstream-style colocated `vitest` server tests plus focused browser route tests, rather than a parallel bespoke OptiDev test harness.
