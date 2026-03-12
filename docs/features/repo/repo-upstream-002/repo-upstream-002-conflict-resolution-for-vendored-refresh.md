# repo-upstream-002: conflict resolution for vendored refresh

## Summary
Automatically resolve known upstream refresh conflicts where stable OptiDev integration points overlap with high-churn `t3code` files.

## Behavior
- `scripts/t3code-sync.mjs refresh` now attempts targeted conflict resolution after `git apply --3way` reports unmerged paths.
- The workflow currently ships deterministic resolvers for:
  - `apps/server/src/wsServer.ts`
  - `apps/web/src/components/Sidebar.tsx`
  - `apps/web/vitest.browser.config.ts`
- `wsServer.ts` resolution preserves the upstream server refactor while re-injecting the OptiDev HTTP route hook and import.
- `Sidebar.tsx` resolution preserves the newer upstream sidebar shell while re-inserting the OptiDev workspace entry and active-route tracking.
- `vitest.browser.config.ts` resolution unions the upstream browser test list with the OptiDev route browser test.
- When all conflicted files are covered by known resolvers, refresh continues and reports the resolved paths in the CLI result payload.
- Any remaining unmerged paths still fail the refresh explicitly; the workflow does not silently guess beyond the known hotspot set.

## Notes
- On 2026-03-12, a real dry-run against upstream `main` resolved the previously failing hotspot conflicts automatically and reported:
  - `apps/server/src/wsServer.ts`
  - `apps/web/src/components/Sidebar.tsx`
  - `apps/web/vitest.browser.config.ts`
- This feature does not claim to solve arbitrary future conflicts; it codifies the current stable merge rules for the existing OptiDev integration seams.
