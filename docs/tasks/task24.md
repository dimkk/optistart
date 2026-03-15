# task24

## goal
- Publish the current Telegram/session-sync fixes through the repository release flow.
- Bump the release version to the next `.1` prerelease/stable values expected by the repository automation.
- Push the release path through both `test` and `main` branches without disturbing the live `dev` runtime on port `8886`.

## architecture
- Reuse the existing repository-owned release automation in `scripts/prepare-release.mjs`, `scripts/release-lib.mjs`, and the GitHub workflows instead of hand-editing version files.
- Land the current working tree changes on `dev` first, then promote through `test` and `main` as separate git pushes so the existing nightly/stable workflows stay the source of truth.
- Keep the live `dev` runtime process untouched while using git/worktree operations for branch promotion if remote branches have moved.

## atomic features
- Finalize and commit the current Telegram bridge/session-sync hardening changes.
- Bump the repository release metadata to the next release values required for `test` and `main`.
- Publish to `test`.
- Publish to `main`.
- Verify that the release workflows were triggered for the promoted commits.

## test plan
- Re-run the targeted Telegram/server/web validation for the current working tree before promotion.
- Run the repository-owned release/version inspection commands to confirm the next versions.
- Verify the pushed branch heads and GitHub workflow runs after promotion.

## approvals / notes
- User explicitly asked to bump and publish through `test` and `main`.
- Live `dev` runtime on `8886` must not be stopped or restarted during this release cycle.
- Release interpretation for the requested `..1` bump: align `test` with the current `main` release line before publishing so the nightly workflow produces the next `alpha.1` tag instead of incrementing the stale legacy prerelease line.
