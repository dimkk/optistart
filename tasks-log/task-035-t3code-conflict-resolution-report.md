# Task 035 Report

## Implemented behavior
- Added hotspot-specific conflict resolvers to `scripts/t3code-sync-lib.mjs` so vendored refresh can continue when the known OptiDev integration seams collide with upstream `t3code` refactors.
- The refresh workflow now auto-resolves:
  - `apps/server/src/wsServer.ts`
  - `apps/web/src/components/Sidebar.tsx`
  - `apps/web/vitest.browser.config.ts`
- `refresh` now returns `resolvedConflicts` in its result payload so operators can see exactly which files were merged by repository-owned rules.

## Tests added or updated
- Expanded `scripts/t3code-sync.test.mjs` with a conflict fixture that reproduces the three hotspot files and verifies that refresh succeeds without manual edits.
- Verified:
  - `node --test scripts/t3code-sync.test.mjs`
  - `node scripts/t3code-sync.mjs refresh --target-ref main --dry-run --allow-dirty`
  - `bash scripts/verify-doc-layout.sh`

## Important decisions
- Used targeted resolvers instead of a general-purpose text merge engine so the repository only auto-merges files where the desired OptiDev integration behavior is explicit and reviewable.
- Built resolver output from the clean target upstream file plus current vendored OptiDev snippets, rather than from conflict-marker output, to avoid preserving partial failed merges.
- Kept unresolved paths as a hard failure condition even after adding known resolvers.

## Open loops or known limits
- The current vendored tree is still dirty, so write-mode refresh remains intentionally blocked unless the operator opts into `--allow-dirty`.
- The resolver set is intentionally narrow; new upstream conflict hotspots still need to be added deliberately if they appear in future refreshes.
