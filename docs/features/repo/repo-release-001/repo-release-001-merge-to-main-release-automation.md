# repo-release-001: branch-owned release automation

## Summary
Drive product versioning from the outer repository so pushes to `test` produce nightly prereleases and pushes to `main` produce stable releases, with each channel owning validation, version bumping, tagging, compact JS runtime bundle publication, and GitHub release publication.

## Behavior
- `scripts/release-manifest.json` is the repository-owned source of truth for the shipped `optid` product version.
- `scripts/prepare-release.mjs` computes the next version in a channel-aware way and synchronizes that version into the versioned `ui` package manifests.
- `.github/workflows/release-test-nightly.yml` runs on pushes to `test` and:
  - skips bot-authored bump commits marked with `[skip nightly release]`
  - runs repository validation
  - bumps the product version in `nightly` mode
  - commits the synchronized manifests back to `test`
  - creates an annotated prerelease tag and pushes it as an explicit remote tag ref
  - passes the prepared release commit SHA into the release job so runtime bundle publication is anchored to the prepared release commit
  - builds the shipped runtime assets, assembles a minimal release tarball, and publishes a prerelease GitHub release with the runtime bundle, installers, and the release manifest
- `.github/workflows/release-main-stable.yml` runs on pushes to `main` and:
  - skips bot-authored bump commits marked with `[skip stable release]`
  - runs repository validation
  - bumps the product version in `stable` mode
  - commits the synchronized manifests back to `main`
  - creates an annotated stable tag and pushes it as an explicit remote tag ref
  - passes the prepared release commit SHA into the release job so runtime bundle publication is anchored to the prepared release commit
  - builds the shipped runtime assets, assembles a minimal release tarball, and publishes a stable GitHub release with the runtime bundle, installers, and the release manifest

## Notes
- Nightly bumps advance prerelease versions without promoting them to stable, for example `0.0.4-alpha.1 -> 0.0.4-alpha.2`, and `0.0.4 -> 0.0.5-alpha.1`.
- Stable bumps promote prerelease versions to the matching stable release or increment the stable patch, for example `0.0.4-alpha.2 -> 0.0.4` and `0.0.4 -> 0.0.5`.
- Tagged release installs consume the compact runtime tarball from GitHub Releases, install only production server dependencies with `npm`, and run native commands through the bundled Node CLI runtime.
- Local repo and branch snapshot installs still use the Bun source-build path, so operator and nightly workflows keep the existing editable repository semantics.
