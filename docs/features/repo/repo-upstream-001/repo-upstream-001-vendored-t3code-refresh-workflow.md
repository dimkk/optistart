# repo-upstream-001: vendored t3code refresh workflow

## Summary
Maintain the vendored `./ui/` fork with a repeatable upstream refresh workflow that records the current upstream base, rebuilds the local OptiDev overlay, and replays that overlay onto a newer `t3code` ref.

## Behavior
- The repository records the vendored upstream base in `ui/.t3code-upstream.json`.
- `scripts/t3code-sync.mjs` is the repository-owned entrypoint for vendor maintenance:
  - `status` reports the recorded upstream base plus dirty vendored paths.
  - `bootstrap --base-ref <ref>` records the current vendored upstream base without touching `./ui/`.
  - `refresh --target-ref <ref>` clones upstream into a temporary workspace, rebuilds the OptiDev overlay from the recorded base to the current vendored tree, and replays that overlay onto the target upstream ref.
- The refresh workflow refuses to write over a dirty vendored tree unless `--allow-dirty` is set.
- Transient workspace artifacts are excluded from overlay reconstruction and mirror writes:
  - `node_modules`
  - `.turbo`
  - `.bun`
  - build outputs
  - Playwright reports and screenshots
- Upstream symlinks such as `CLAUDE.md -> AGENTS.md` are preserved during overlay reconstruction and vendor refresh.
- When overlay replay cannot be applied cleanly, the workflow fails with explicit conflict paths instead of overwriting files silently.

## Notes
- The current repository bootstrap metadata pins the vendored `ui/` base to upstream commit `c97c6b7836ce888b24a157de8eb4aea761028979`, inferred from vendor import commit `c0e5860` by exact blob matches across 456 of 461 shared upstream paths.
- A dry-run against upstream `main` on 2026-03-11 reports real replay conflicts in:
  - `apps/server/src/wsServer.ts`
  - `apps/web/src/components/Sidebar.tsx`
  - `apps/web/vitest.browser.config.ts`
- The vendored product still lives in `./ui/`; this workflow manages refreshes into that path rather than introducing a second upstream mirror checkout into the repository.
