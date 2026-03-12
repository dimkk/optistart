# Task 15

## goal
Refactor repository-owned GitHub release automation into two branch-specific channels:
- `test` push/merge -> validation -> nightly prerelease version bump -> nightly release publication with packaged desktop binaries
- `main` push/merge -> validation -> stable version bump -> stable release publication with packaged desktop binaries

## architecture
- Keep release ownership in the outer repository, not only in `./ui/.github/`, because the shipped product is `optid + vendored t3code + OptiDev overlays`.
- Split branch promotion into two explicit release workflows:
  - nightly workflow for `test`
  - stable workflow for `main`
- Each workflow must be end-to-end:
  - branch push trigger
  - shared repository validation
  - channel-aware version bump
  - bot commit back to the source branch with a skip marker
  - tag creation and push
  - desktop binary packaging across GitHub Actions runner matrix
  - GitHub release publication
- Keep one shared version source of truth in `scripts/release-manifest.json`, but make bumping channel-aware:
  - `main` promotes prerelease to stable or bumps stable patch
  - `test` advances prerelease/nightly versions without promoting to stable
- Keep installer behavior aligned with the channel split:
  - stable remote installer remains default
  - branch/nightly installer can explicitly target `test`

## atomic features
- `repo-release-001`:
  Replace the old bump-then-separate-publish flow with branch-specific nightly/stable workflows that validate, bump, tag, package binaries, and publish releases.
- `cli-launch-001`:
  Keep installer/launcher docs and branch-aware install behavior aligned with stable versus nightly channels.

## test plan
- Unit:
  Cover channel-aware version bump behavior in release utilities.
- Integration:
  Validate workflow YAML shape, release helper scripts, and installer syntax/entrypoints.
- E2E:
  Ensure `test` and `main` workflows are branch-triggered and release binary artifacts plus source/install assets from the tagged ref.
- Regression:
  Cover skip-marker loop prevention, prerelease increment behavior on `test`, stable promotion behavior on `main`, and nightly installer compatibility with the `test` branch.

## approvals / notes
- User requested on 2026-03-13 two release workflows: one for `test` nightly builds with tests, version bump, nightly publishing, and binary packaging; one for `main` stable publishing.
- This task changes a persistent release-process contract, so the dossier is refreshed before implementation.
