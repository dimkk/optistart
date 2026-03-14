# task21

## goal
- Investigate why published desktop release artifacts are currently around 128-250 MB.
- Replace Electron release artifacts with a compact JS-first runtime bundle.
- Validate locally that the published release payload stays below the user target ceiling while still installing and running correctly.

## architecture
- Measure the current artifact size baseline from the repository-owned desktop packaging path in `ui/scripts/build-desktop-artifact.ts`.
- Inspect the staged desktop payload, including bundled web/server outputs and packaged runtime dependencies, to identify the dominant size contributors.
- Keep local/manual desktop packaging available for future work, but remove Electron binaries from the automated stable/nightly release workflows.
- Build and ship a compact installed-runtime tarball containing launcher scripts, prebuilt `ui/apps/server/dist`, and a release-specific production `ui/apps/server/package.json`.
- Keep local repo and branch snapshot install paths on the existing Bun source-build contract, but let tagged releases install only Node/npm production dependencies.
- Point stable/nightly installers at GitHub release assets instead of repository source archives.

## atomic features
- Add a reproducible local size baseline for at least one packaged desktop target.
- Remove desktop artifact publication from stable and nightly release automation.
- Publish a compact JS runtime tarball instead of a full source archive.
- Make installed releases run from bundled Node runtime artifacts instead of Bun source execution.
- Update release packaging docs/contracts to reflect the JS-first release path.
- Record the resulting size delta and any remaining structural limits in a task report.

## test plan
- Build at least one local desktop release artifact through `bun run dist:desktop:artifact` to establish the Electron baseline.
- Measure staged payload and final artifact sizes before the release-contract change.
- Build the precompiled runtime bundle locally and measure the resulting tarball size.
- Extract the local release tarball, install production server dependencies, and verify `optid --version` plus `optid status` from the installed bundle.
- Re-run release-path validation needed to keep the runtime-bundle workflow coherent.

## approvals / notes
- User explicitly requested release artifact size optimization and local validation.
- User explicitly selected variant 1: stop shipping Electron artifacts in the automated release and ship JS/source bundles instead.
- During implementation, the shipped contract was tightened further from whole-repo source snapshots to a compact installed-runtime tarball so the release stays comfortably under the target size ceiling.
- This is a cross-cutting release-packaging change, so implementation should proceed from this dossier with the user-visible scope tracked here.
