# Task 036 Report

## Implemented behavior
- Added a repository-owned version source of truth in `scripts/release-manifest.json`.
- Added release/version helpers in `scripts/release-lib.mjs` and release prep CLI in `scripts/prepare-release.mjs`.
- Added root GitHub workflows:
  - `.github/workflows/release-bump.yml`
  - `.github/workflows/release-publish.yml`
- Added a shared launcher/runtime entrypoint in `scripts/optid-runner.mjs`.
- Updated `scripts/optid` to route through the shared launcher and added Windows shims:
  - `scripts/optid.ps1`
  - `scripts/optid.cmd`
- Added installer flows for both shell and PowerShell:
  - `scripts/install.sh`
  - `scripts/install.ps1`
- Installed releases now use a versioned layout and a stable `optid` launcher, instead of relying only on a git clone checkout.
- `optid` now:
  - starts the bundled UI when called with no args
  - exposes `optid ui`
  - exposes `optid --version`
  - keeps existing OptiDev CLI subcommands working
- Added release update checks with cached latest-tag lookup and upgrade suggestions.

## Tests added or updated
- Added:
  - `scripts/release-lib.test.mjs`
  - `scripts/optid-launcher-lib.test.mjs`
- Verified:
  - `node --test scripts/release-lib.test.mjs scripts/optid-launcher-lib.test.mjs scripts/t3code-sync.test.mjs`
  - `bash -n scripts/install.sh scripts/optid`
  - `node scripts/prepare-release.mjs show`
  - `bun scripts/optid-runner.mjs --root /home/dimkk/new-proj/optistart --version`
  - `OPTIDEV_HOME=/tmp/optid-update-check-test bun scripts/optid-update-check.mjs --force`
  - `bun scripts/optid-runner.mjs --root /home/dimkk/new-proj/optistart status`

## Important decisions
- Kept the product version in the outer repository instead of trying to infer it from the vendored `ui` subtree.
- Used tag-driven GitHub releases plus source bundles instead of introducing a separate binary package registry.
- Kept existing native OptiDev CLI behavior, but changed the top-level `optid` launcher default to opening the bundled UI/server product.
- Restricted automatic update checks to installed releases by default so local repository development is not noisy unless explicitly enabled.

## Open loops or known limits
- The current release publish workflow ships source bundles and install entrypoints; it does not yet publish standalone native binaries.
- Windows installer behavior is implemented but not executed in this Linux environment.
