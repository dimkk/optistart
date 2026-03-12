# Task 037

## Implemented Behavior
- Added `scripts/run-main-pr-checks.sh` as the repository-owned validation suite for `main`-bound changes.
- Added `.github/workflows/pr-main-checks.yml` so pull requests targeting `main` run the shared validation suite before merge.
- Updated `.github/workflows/release-bump.yml` to reuse the same validation suite before bumping and tagging a merge commit.
- Added `optid t3code [status|bootstrap|refresh]` through the shipped launcher, delegating to `scripts/t3code-sync.mjs`.
- Added `node-pty` to Bun `trustedDependencies` in `ui/package.json` so the full vendored server suite can build/load the native PTY module during validation.
- Fixed `scripts/optid-runner.mjs` so native CLI commands keep the caller working directory instead of forcing repo root, restoring the expected `optid init/start/...` behavior outside the checkout root.
- Updated `README.md` with a short top-level product summary, the new `optid t3code` operator flow, and the shared validation command.

## Tests Added Or Updated
- Extended `scripts/optid-launcher-lib.test.mjs` with explicit routing coverage for `optid t3code`.
- Added repository validation coverage through `scripts/run-main-pr-checks.sh` and GitHub workflow wiring.

## Important Decisions
- Kept vendored upstream maintenance outside `ui/apps/server/src/optidevCli.ts` because it is a repository operator workflow, not a workspace runtime command.
- Centralized PR and release validation in one script to avoid drift between pre-merge checks and post-merge release automation.
- Kept `playwright install --with-deps chromium` as the first path for CI parity, but added a browser-only fallback so local validation does not require `sudo`.
- Updated `README.md` instead of creating `README.me` because the repository contract only permits `README.md` as root-level markdown.

## Open Loops Or Known Limits
- The shared validation suite installs Playwright Chromium during runs, so CI duration is tied to browser runtime availability.
- `optid t3code refresh` still depends on the existing refresh workflow and its resolver coverage for future upstream conflicts beyond the currently known hotspot set.
