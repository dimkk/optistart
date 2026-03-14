# repo-release-002: pr validation for main

## Summary
Require one repository-owned validation suite on pull requests targeting `main` so the merge gate and release bump automation use the same checks.

## Behavior
- `scripts/run-main-pr-checks.sh` is the shared validation entrypoint for repository-owned checks.
- The validation script installs vendored workspace dependencies, runs root script tests, verifies doc/layout constraints, runs vendored lint/tests, installs the browser runtime, and executes the OptiDev browser route suite.
- Server validation no longer depends on `node-pty` native bindings being loadable during CI bootstrap; when the native module is unavailable, the server falls back to an explicit unavailable PTY adapter so unrelated CLI and WebSocket tests can still validate the repository.
- `.github/workflows/pr-main-checks.yml` runs the shared validation script for every pull request targeting `main`.
- `.github/workflows/release-main-stable.yml` reuses the same validation script before applying the stable version bump, tag, binary packaging, and release publication on pushes to `main`.

## Notes
- The repository now keeps PR validation and post-merge release validation in sync by using one script instead of duplicating command lists across workflows.
- The browser install remains inside the shared validation script so CI and local operator runs exercise the same path, with a browser-only fallback when local runs cannot escalate to install OS packages via `sudo`.
- The PTY fallback preserves fail-fast behavior for real terminal open attempts: the server starts and non-terminal validations continue, but `terminal.open` still returns a clear PTY-unavailable error when native support is missing.
