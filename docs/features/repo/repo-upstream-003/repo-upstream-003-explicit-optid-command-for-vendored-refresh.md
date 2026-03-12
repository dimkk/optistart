# repo-upstream-003: explicit optid command for vendored refresh

## Summary
Expose vendored `t3code` upstream maintenance through the shipped `optid` launcher so operators can inspect or refresh the upstream base without remembering internal script paths.

## Behavior
- `optid t3code status` delegates to `scripts/t3code-sync.mjs status`.
- `optid t3code bootstrap ...` delegates to `scripts/t3code-sync.mjs bootstrap ...`.
- `optid t3code refresh ...` delegates to `scripts/t3code-sync.mjs refresh ...`.
- `optid t3code` defaults to `status` so the explicit maintenance command has a safe no-write default.
- The command routing lives in `scripts/optid-launcher-lib.mjs` and `scripts/optid-runner.mjs`, keeping vendored refresh outside the native runtime CLI implemented under `ui/apps/server/src/optidevCli.ts`.

## Notes
- This command is intended for repository operators and installed-release maintainers; it does not change the existing native OptiDev workspace CLI surface.
- The operator-facing refresh path still respects the sync workflow protections, including dirty-tree checks unless `--allow-dirty` is passed.
