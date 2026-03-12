# Task 038

## implemented behavior
- Added `optid runner ls` to enumerate resumable runner sessions with ordinal alias, runner type, guid, cwd, and latest user phrase.
- Added `optid runner resume <id>` to resolve an alias from the current inventory and resume that thread through the live OptiDev server.
- Added a server-side `runner_resume` action bridge so resume executes inside the long-lived `t3code`/OptiDev process and reuses persisted provider bindings.

## tests added or updated
- Added `ui/apps/server/src/optidevRunner.test.ts` for inventory shaping, alias resolution, and server-side recovery.
- Updated `ui/apps/server/src/optidevCli.test.ts` to cover native `runner ls/resume`.
- Updated `ui/apps/server/src/optidevCliShim.test.ts` to cover shipped `scripts/optid runner ls/resume`.

## important decisions
- Inventory is local and deterministic from `state.sqlite`, so aliases do not depend on a live server round-trip.
- Resume is server-backed, because provider sessions live in the long-running server process rather than the short-lived CLI process.
- The external CLI is runner-generic even though the current runtime data source is Codex-backed.

## open loops or known limits
- The current server action only resumes by canonical thread guid; it does not yet expose remote inventory over HTTP because local sqlite already provides the required listing.
- Non-Codex runner backends will need to persist compatible runtime bindings to appear in the same inventory without CLI changes.
