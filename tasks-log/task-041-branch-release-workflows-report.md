# Task 041

## implemented behavior
- Replaced the old root release split (`release-bump.yml` plus tag-triggered `release-publish.yml`) with two branch-owned release workflows:
  - `.github/workflows/release-test-nightly.yml`
  - `.github/workflows/release-main-stable.yml`
- Both workflows are now end-to-end:
  - run repository validation
  - apply a channel-aware version bump
  - commit the bump back to the source branch with a skip marker
  - create and push the matching tag
  - build packaged desktop binaries on GitHub Actions runners
  - publish a GitHub release with source archives, installers, manifest, and desktop artifacts
- Added channel-aware version bump logic:
  - `stable` promotes prerelease versions to stable or increments the stable patch
  - `nightly` advances prerelease versions or starts the next patch line as `-alpha.1`
- Kept installer behavior aligned with the release split by documenting and supporting nightly branch installs through `OPTID_GIT_REF=test`.
- Updated `README.md` so the top-level install/release guidance reflects `test` nightly versus `main` stable automation.
- Adjusted both installer scripts so `OPTID_GIT_REF=test` also switches manifest resolution to the same branch, avoiding `main`-only raw manifest lookups during nightly installs.

## tests added or updated
- Updated `scripts/release-lib.test.mjs` to cover nightly version bump behavior.
- Verified:
  - `node --test scripts/release-lib.test.mjs scripts/optid-launcher-lib.test.mjs`
  - `bash -n scripts/install.sh scripts/run-main-pr-checks.sh`
  - `python3` + `yaml.safe_load(...)` for `.github/workflows/release-test-nightly.yml`, `.github/workflows/release-main-stable.yml`, and `.github/workflows/pr-main-checks.yml`
  - `node scripts/prepare-release.mjs bump --channel nightly`

## important decisions
- The branch itself now chooses the release channel:
  - `test` produces prerelease/nightly artifacts
  - `main` produces stable artifacts
- Versioning remains repository-owned in `scripts/release-manifest.json`, but channel selection is delegated to workflow-triggered `prepare-release` calls.
- Skip markers were split by channel to avoid self-trigger loops while still making intent obvious in git history.

## open loops or known limits
- Workflow execution on GitHub still depends on the signing secrets configured for optional signed desktop artifacts.
- PowerShell runtime parsing was not locally executed in this Linux environment; workflow/installer contract was verified through syntax-adjacent checks and the existing Windows installer structure.
