# task-054 compact release promotion report

## implemented behavior
- Promoted the compact JS runtime release path from `dev` onto `test` and `main`.
- Removed the stale desktop/Electron release workflow from the published release branches in favor of the runtime tarball flow.
- Kept the Telegram/session-sync fixes on top of the updated release branches so the next nightly/stable runs publish from the current branch state.

## tests added or updated
- Re-ran `bash scripts/run-main-pr-checks.sh` on the promoted publish tree after cherry-picking the compact release commit.

## important decisions
- Treated the missing compact release promotion as the real root cause behind repeated GitHub release churn: the published branches were still executing the old desktop matrix while `dev` already had the JS-first release path.
- Used isolated worktrees for `test` and `main` so the live OptiDev runtime on port `8886` stayed untouched.

## open loops or known limits
- GitHub release verification still depends on the new `test` and `main` workflow runs completing successfully after the promotion pushes.
- Stable/nightly workflow concurrency is now hardened separately so a newer branch push cancels an older in-flight release run instead of letting overlapping runs compete for the same branch lifecycle.
