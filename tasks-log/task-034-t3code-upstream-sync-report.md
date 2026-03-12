# Task 034 Report

## Implemented behavior
- Added a repository-owned vendored fork refresh workflow at `scripts/t3code-sync.mjs` with:
  - `status`
  - `bootstrap`
  - `refresh`
- Added `scripts/t3code-sync-lib.mjs` so the workflow is testable without shelling all logic into one script.
- Recorded the current vendored `t3code` base in `ui/.t3code-upstream.json`.
- The refresh workflow now:
  - clones upstream into a temporary workspace
  - reconstructs the local OptiDev overlay from the recorded base to the current vendored `ui/` tree
  - replays that overlay onto a target upstream ref with `git apply --3way`
  - preserves upstream symlinks
  - ignores transient workspace artifacts
  - reports conflicting files explicitly instead of silently overwriting vendored code

## Tests added or updated
- Added `scripts/t3code-sync.test.mjs`.
- Verified:
  - `node --test scripts/t3code-sync.test.mjs`
  - `node scripts/t3code-sync.mjs status`
  - `node scripts/t3code-sync.mjs refresh --target-ref main --dry-run --allow-dirty`

## Important decisions
- Treat the vendored `ui/` tree as the shipped product and refresh it in place instead of introducing a second persistent upstream checkout into the repository.
- Store the vendored upstream base in `ui/.t3code-upstream.json` so future refreshes are built from a known commit instead of an implicit historical guess.
- Bootstrap the current base from upstream commit `c97c6b7836ce888b24a157de8eb4aea761028979`, chosen by exact blob matches against the original vendor import commit `c0e5860`.

## Open loops or known limits
- The current repository still has local uncommitted `ui/` work, so a write-mode refresh is intentionally blocked unless the operator opts into `--allow-dirty`.
- A real dry-run against upstream `main` on 2026-03-11 reports replay conflicts in:
  - `ui/apps/server/src/wsServer.ts`
  - `ui/apps/web/src/components/Sidebar.tsx`
  - `ui/apps/web/vitest.browser.config.ts`
- Those conflicts are now surfaced deterministically, but they still require an actual follow-up integration pass before the vendored fork can be moved to upstream `main`.
