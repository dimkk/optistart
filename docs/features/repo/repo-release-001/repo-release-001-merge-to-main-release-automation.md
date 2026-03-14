# repo-release-001: branch-owned release automation

## Summary
Drive product versioning from the outer repository so pushes to `test` produce nightly prereleases and pushes to `main` produce stable releases, with each channel owning validation, version bumping, tagging, binary packaging, and GitHub release publication.

## Behavior
- `scripts/release-manifest.json` is the repository-owned source of truth for the shipped `optid` product version.
- `scripts/prepare-release.mjs` computes the next version in a channel-aware way and synchronizes that version into the versioned `ui` package manifests.
- `.github/workflows/release-test-nightly.yml` runs on pushes to `test` and:
  - skips bot-authored bump commits marked with `[skip nightly release]`
  - runs repository validation
  - bumps the product version in `nightly` mode
  - commits the synchronized manifests back to `test`
  - creates an annotated prerelease tag and pushes it as an explicit remote tag ref
  - passes the prepared release commit SHA into downstream jobs so builds do not depend on remote tag lookup timing
  - builds desktop binaries across the GitHub Actions platform matrix
  - publishes a prerelease GitHub release with source bundles, installers, manifest, and packaged desktop artifacts
- `.github/workflows/release-main-stable.yml` runs on pushes to `main` and:
  - skips bot-authored bump commits marked with `[skip stable release]`
  - runs repository validation
  - bumps the product version in `stable` mode
  - commits the synchronized manifests back to `main`
  - creates an annotated stable tag and pushes it as an explicit remote tag ref
  - passes the prepared release commit SHA into downstream jobs so builds do not depend on remote tag lookup timing
  - builds desktop binaries across the GitHub Actions platform matrix
  - publishes a stable GitHub release with source bundles, installers, manifest, and packaged desktop artifacts

## Notes
- Nightly bumps advance prerelease versions without promoting them to stable, for example `0.0.4-alpha.1 -> 0.0.4-alpha.2`, and `0.0.4 -> 0.0.5-alpha.1`.
- Stable bumps promote prerelease versions to the matching stable release or increment the stable patch, for example `0.0.4-alpha.2 -> 0.0.4` and `0.0.4 -> 0.0.5`.
