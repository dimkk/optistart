# Task 042 Report: Codex sidebar session inventory

## Implemented behavior

- Added a UI-only `codex_sessions` OptiDev action that reads the local Codex state database from `~/.codex/state_*.sqlite`.
- The sidebar now renders machine-local unarchived Codex sessions from the Codex `threads` table instead of the live runner inventory.
- Session rows are sorted by latest Codex activity and enriched with OptiDev manifest presence:
  - manifest found -> normal entry
  - manifest missing or invalid -> `*` marker in the sidebar
- Existing CLI `optid runner ls` and `optid runner resume` semantics remain unchanged.

## Tests added or updated

- `ui/apps/server/src/optidevRunner.test.ts`
  - covers latest Codex sqlite selection
  - covers archived-thread filtering
  - covers manifest presence enrichment for local Codex sessions
- `ui/apps/server/src/optidevRoute.test.ts`
  - validates `codex_sessions` payload delivery through the live OptiDev route
- `ui/apps/web/src/routes/-optidev.browser.tsx`
  - validates sidebar rendering of machine-local Codex sessions and `*` marker behavior

## Important decisions

- The sidebar source of truth is the local Codex machine state, not the T3 provider runtime inventory.
- A separate `codex_sessions` action was added instead of repointing `runner_list`, so CLI runner flows do not change contract.
- Manifest status was kept intentionally binary: `present` or `missing`.

## Open loops or known limits

- The sidebar currently treats all unarchived Codex `threads` rows as visible sessions; it does not distinguish primary threads from subagent threads.
- If the local Codex state DB is absent, the sidebar returns an empty session list rather than synthesizing entries.
