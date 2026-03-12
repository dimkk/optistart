# Task 12

## goal
Turn OptiDev into a releaseable product with a repository-owned release pipeline, installer/update flow, and shipped `optid` launcher so merging to `main` can advance the product version and installed local CLIs can detect newer tagged releases and offer an update path.

## architecture
- Define one repository-owned version source of truth that can drive:
  - release tags
  - installer/update metadata
  - shipped CLI version output
  - vendored `t3code` app version where required
- Add a root-level GitHub release pipeline so a merge to `main` can:
  - compute and commit the next version bump
  - create or advance the release tag
  - build or publish release artifacts from the tagged ref
- Keep release automation in the outer repository, not only inside `./ui/.github/`, because the shipped product is `optid + vendored t3code + OptiDev integrations`.
- Add a release-discovery contract for installed local CLIs:
  - read current installed version locally
  - check the latest remote tag/release
  - if remote is newer, print an explicit update suggestion before or during CLI startup
- Make install/update flows platform-aware:
  - Unix shell install via `curl | sh`
  - Windows install via PowerShell `Invoke-WebRequest`
- Install into a versioned local layout and expose one stable `optid` command that starts the shipped `t3code` runtime with OptiDev integrated, instead of only invoking a raw source file from the repository checkout.
- Keep local developer checkouts usable, but distinguish clearly between:
  - local repository mode
  - installed release mode

## atomic features
- `repo-release-001`:
  Root release automation bumps version on merge to `main`, creates the corresponding tag, and drives release builds from repository-owned control.
- `repo-release-002`:
  Pull requests targeting `main` must run the full repository validation suite before merge.
- `cli-update-001`:
  Installed local CLIs compare their local version to the latest remote tag and offer a clear update suggestion when the remote release is newer.
- `cli-launch-001`:
  Installer and launcher flows expose a stable `optid` command that starts the shipped vendored `t3code` + OptiDev product from an installed release layout.

## test plan
- Unit:
  Cover semver bumping, version parsing/comparison, release-manifest resolution, and launcher path selection.
- Integration:
  Exercise release metadata generation and installer/update flows against temporary local fixtures or mocked release metadata, including upgrade from an older installed version.
- E2E:
  Validate merge-to-main release automation on GitHub Actions test branches or dry-run workflows, plus real shell/PowerShell installer entrypoints and installed `optid` startup behavior.
- Regression:
  Cover local-repo mode versus installed-release mode, remote tag lookup failures, repeated installs, and safe no-op behavior when already on the latest version.

## approvals / notes
- User requested this release/productization workflow on 2026-03-12 with these concrete constraints:
  - merge to `main` should drive version bumping
  - pull requests into `main` should run the full test suite
  - installed local CLIs should detect a newer latest tag and suggest updating
  - install should work via `curl | sh` and PowerShell web request
  - installed `optid` should launch the shipped vendored `t3code` + OptiDev UI
- User explicitly approved this dossier on 2026-03-12 before implementation started.
