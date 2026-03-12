# cli-launch-001: installed optid launcher

## Summary
Ship one stable `optid` entrypoint that can launch the bundled `t3code` + OptiDev UI or delegate to the native OptiDev CLI commands from either a local checkout or an installed release layout.

## Behavior
- `scripts/optid-runner.mjs` is the shared launcher for shell and Windows shims.
- `optid` with no arguments starts the bundled `t3code` server/UI stack from the installed or local release layout.
- `optid ui` is an explicit alias for the same bundled UI startup path.
- `optid status`, `optid start`, `optid memory`, and other CLI subcommands still delegate to the native TS/Bun OptiDev CLI in `ui/apps/server/src/optidevCli.ts`.
- `optid --version` and `optid version` print the shipped product version from `scripts/release-manifest.json`.
- The launcher builds the bundled UI on demand if the built server/web assets are missing.
- Installers expose this launcher through:
  - Unix shell `scripts/optid`
  - Windows PowerShell `scripts/optid.ps1`
  - Windows command shim `scripts/optid.cmd`

## Notes
- Installed releases use a versioned layout under the install root and switch the stable launcher through a `current` pointer.
- The launcher requires `bun` for all modes and `node` for bundled UI startup/build flows.
