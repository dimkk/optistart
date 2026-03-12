# repo-release-001: merge-to-main release automation

## Summary
Drive product versioning from the outer repository so merging to `main` prepares the next release version, commits the bump, and creates the matching tag that triggers release publication.

## Behavior
- `scripts/release-manifest.json` is the repository-owned source of truth for the shipped `optid` product version.
- `scripts/prepare-release.mjs` computes the next version and synchronizes that version into the versioned `ui` package manifests.
- `.github/workflows/release-bump.yml` runs on pushes to `main` and:
  - skips bot-authored bump commits marked with `[skip release bump]`
  - runs repository release tests
  - bumps the product version
  - commits the synchronized manifests
  - creates and pushes the matching `v*` tag
- `.github/workflows/release-publish.yml` runs on pushed `v*` tags and publishes a GitHub release with source bundles and install entrypoints.

## Notes
- Prerelease versions are promoted to the matching stable version on the next release bump, for example `0.0.4-alpha.1 -> 0.0.4`.
- Stable versions default to a patch bump on the next merge-to-`main` release, for example `0.0.4 -> 0.0.5`.
