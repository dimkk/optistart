# task-050 compact JS release report

## implemented behavior
- Replaced Electron release publication with a compact JS runtime tarball built by `scripts/build-release-bundle.mjs`.
- Added a bundled `ui/apps/server/dist/optidevCli.mjs` entrypoint so installed releases run native OptiDev commands through Node instead of Bun source execution.
- Switched `scripts/optid`, `scripts/optid.ps1`, and `scripts/optid.cmd` to a node-first launcher path.
- Updated `scripts/install.sh` and `scripts/install.ps1` so tagged releases download the GitHub release tarball and install only production server dependencies with `npm`, while local repo and branch snapshot installs stay on the Bun source-build path.
- Updated stable/nightly release workflows to build runtime assets, assemble the compact tarball, and publish that tarball instead of full repo snapshots or desktop artifacts.

## tests added or updated
- Extended `scripts/release-lib.test.mjs` with release bundle filename/URL and installed-runtime server package coverage.
- Added syntax coverage for `scripts/build-release-bundle.mjs` and `scripts/optid-runner.mjs` to `scripts/run-main-pr-checks.sh`.
- Local verification completed with:
  - `node --test scripts/release-lib.test.mjs scripts/optid-launcher-lib.test.mjs`
  - `cd ui && bun run build:runtime`
  - `node scripts/build-release-bundle.mjs --output-dir /tmp/optid-release-assets`
  - extract bundle, `npm install --omit=dev`, `node scripts/optid-runner.mjs --root <bundle> --version`
  - extract bundle, `npm install --omit=dev`, `node scripts/optid-runner.mjs --root <bundle> status`

## important decisions
- Tagged releases now prefer Node/npm over Bun for the installed runtime because the compact bundle ships prebuilt server and CLI assets.
- Bun remains required for editable local repo installs and branch snapshot installs so developer and nightly-source workflows keep the existing behavior.
- The public release asset is tarball-only; Windows install now extracts the same `.tar.gz` bundle via `tar`.

## open loops or known limits
- The bundled web client is still the biggest contributor inside the compact tarball because it ships the full renderer asset set; the current measured tarball was about `3.29 MB`, which is under the target ceiling.
- `optid t3code ...` remains meaningful primarily in a full repository checkout; the compact installed release is optimized for the shipped runtime, not for upstream-maintenance workflows.
