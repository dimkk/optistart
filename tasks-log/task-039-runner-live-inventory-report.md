# Task 039

## implemented behavior
- Reworked `optid runner ls` to read live open runner sessions from the running OptiDev server instead of reading persisted `provider_session_runtime` rows directly from local sqlite.
- Kept runner inventory shaping operator-facing and runner-generic: alias, runner type, guid, cwd, latest user phrase, runtime status, and session status.
- Preserved `optid runner resume <id>` alias flow, but now resolve aliases from the same live inventory that `runner ls` shows.
- Kept direct guid resume support by forwarding a non-numeric identifier straight to the server-side resume action.
- Added a repository guidance rule to `AGENTS.md` requiring a runtime reality-check when a requirement explicitly says "all", "open", "running", "latest", or "live".

## tests added or updated
- Updated `ui/apps/server/src/optidevRunner.test.ts` to cover live server-backed inventory, alias resolution, and persisted recovery.
- Updated `ui/apps/server/src/optidevCli.test.ts` so native CLI `runner ls/resume` runs against live server action responses instead of seeded sqlite inventory.
- Updated `ui/apps/server/src/optidevCliShim.test.ts` so shipped `scripts/optid runner ls/resume` is verified against the live HTTP action contract.
- Ran:
  - `bun x vitest run apps/server/src/optidevRunner.test.ts apps/server/src/optidevCli.test.ts apps/server/src/optidevCliShim.test.ts`

## important decisions
- The source of truth for "open runner sessions" is now the live server's `ProviderService.listSessions()` result, not persisted sqlite runtime rows.
- Projection snapshot data still enriches live sessions so inventory keeps cwd fallback and latest-user preview without inventing a second runtime registry.
- Persistence remains part of the resume path only, where a stopped session may still need a stored binding and resume cursor.

## open loops or known limits
- `optid runner ls` is intentionally server-backed now, so it requires the OptiDev server to be reachable.
- The current live inventory remains limited to the provider backends that expose sessions through `ProviderService.listSessions()`.
