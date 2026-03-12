# cli-update-001: installed CLI update check

## Summary
Installed `optid` launches can compare the local product version to the latest remote tagged release and print an explicit upgrade suggestion when a newer release exists.

## Behavior
- `scripts/optid-update-check.mjs` reads the local shipped version from `scripts/release-manifest.json`.
- The update check queries remote tags from the repository git URL and compares them with semver-aware ordering.
- Results are cached under `~/.optidev/update-check.json` by default, with cache lifetime controlled by the release manifest.
- Installed release launches check for updates automatically unless `OPTID_DISABLE_UPDATE_CHECK=1` is set.
- Local repository launches remain quiet by default, but can opt in with `OPTID_CHECK_UPDATES=1`.
- When an update is available, `optid` prints both Unix and PowerShell install commands for upgrading to the latest release.

## Notes
- Failed remote checks do not block CLI startup.
- The current remote release source is the repository tag set, not a separate package registry.
