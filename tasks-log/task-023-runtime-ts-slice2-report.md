# Task 023 Report: runtime-ts-002 slice 2

## Implemented behavior
- Extended `runtime-ts-002` with a native TypeScript memory reader in `ui/apps/server/src/optidevMemory.ts`.
- Migrated these read-only memory behaviors from the Python daemon into the forked `t3` server:
  - memory summary
  - open loop listing
  - typed `memory show` for features, tasks, and releases
- Updated `ui/apps/server/src/optidevRoute.ts` so native memory actions resolve project roots the same way the Python path does:
  - explicit `cwd` wins
  - otherwise `target` resolves through discovered projects
  - otherwise the repo root is used
- Kept mutating runtime actions and unmigrated runtime surfaces on daemon fallback.

## Tests added or updated
- Added `ui/apps/server/src/optidevMemory.test.ts`.
- Updated `ui/apps/server/src/optidevRoute.test.ts` to cover:
  - native state with active session + native memory summary
  - native `memory_summary`
  - native `memory_show`
- Re-ran upstream-style browser coverage in `ui/apps/web/src/routes/-optidev.browser.tsx`.
- Re-ran Python compatibility tests for daemon/UI API/CLI behavior.

## Important decisions
- Kept the migration order aligned with product risk: read-only memory queries moved before session mutation or runtime lifecycle actions.
- Matched the `t3` test style by colocating fast `vitest` server tests beside the migrated TypeScript modules and using browser tests only for route/UI integration.
- Made the native parser order-independent for dossier files so repo artifact ordering does not affect runtime behavior.

## Open loops or known limits
- Runtime lifecycle actions (`init`, `start`, `resume`, `reset`, `stop`, clone`) are still daemon-backed.
- Plugin runtime integrations are still daemon-backed.
- CLI parity remains authoritative on the Python side while the `t3` runtime migration continues.
