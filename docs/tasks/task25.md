# task25

## goal
- Align `test` and `main` with the compact JS release path that was already implemented on `dev`.
- Remove the stale desktop/Electron release workflow from the published branches so GitHub stops building oversized desktop artifacts for nightly/stable releases.
- Re-run the `test` and `main` publication flow on the compact release path without touching the live OptiDev runtime on port `8886`.

## architecture
- Reuse the existing compact release implementation from `dev` instead of inventing another release mechanism.
- Promote the compact release commit onto `test` and `main` by cherry-picking it onto the current published heads in isolated worktrees.
- Verify the branch state locally with the repository-owned checks before pushing the release branches again.

## atomic features
- Publish the compact JS release workflow and runtime bundle tooling to `test`.
- Publish the compact JS release workflow and runtime bundle tooling to `main`.
- Verify the resulting branch heads and GitHub workflow behavior.

## test plan
- Inspect the published branch heads to confirm the stale desktop workflow is still present before the fix.
- Cherry-pick the compact release commit onto isolated `test` and `main` worktrees.
- Run `bash scripts/run-main-pr-checks.sh` on the promoted tree before pushing.
- Verify the new GitHub runs start on the updated branch heads.

## approvals / notes
- User asked to check the repeated GitHub failure; the root cause is a missing release-workflow promotion that leaves `test` and `main` on the old desktop release path.
- Live `dev` runtime on `8886` must remain untouched.
