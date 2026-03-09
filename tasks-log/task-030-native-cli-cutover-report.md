# Task 030 Native CLI Cutover Report

## implemented behavior
- Added a native Bun CLI entrypoint at `ui/apps/server/src/optidevCli.ts`.
- Switched the shipped root shim `scripts/optid` from `python -m optidev` to the native Bun CLI.
- Switched `scripts/install.sh` from Python dependency bootstrapping to Bun workspace installation.
- Kept manifest/session/telegram/runtime behavior on the same TS/Bun modules already used by the embedded `/optidev` route.

## tests added or updated
- Added `ui/apps/server/src/optidevCli.test.ts` for native CLI runtime behavior:
  - start/resume
  - telegram lifecycle
  - init/workspace clone
  - memory commands
- Added `ui/apps/server/src/optidevCliShim.test.ts` for real root-shim smoke coverage through `scripts/optid`.
- Re-ran colocated server and browser suites after the CLI cutover.
- Ran live shim smoke:
  - `OPTIDEV_HOME=/tmp/optid-native-cli-home ./scripts/optid status`
  - `OPTIDEV_HOME=/tmp/optid-native-cli-home ./scripts/optid init demo`

## important decisions
- The root `optid` entrypoint is now part of the same native TS/Bun runtime boundary as `/optidev`.
- Telegram, manifest lifecycle, restore, and memory flows were prioritized over recreating old logs/tests helper behavior.
- Legacy Python runtime code remains in the repository only as dormant code, not as the shipped CLI/runtime path.

## open loops or known limits
- Old Python docs/tests still exist in the repository outside the active `v1-2` release surface.
- Logs/tests panes currently execute the configured command directly instead of the old Python file-watching helper behavior.
