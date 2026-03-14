# task-048 release pty fallback report

## implemented behavior
- Reworked server PTY adapter selection in `ui/apps/server/src/serverLayers.ts` so the Node PTY layer is loaded dynamically instead of being pulled in eagerly during module import.
- Added `ui/apps/server/src/terminal/Layers/UnavailablePTY.ts` as a clear lazy-failure fallback when `node-pty` native bindings are unavailable.
- The server now keeps unrelated CLI and WebSocket validation paths alive in CI even if `pty.node` cannot be loaded, while real terminal spawn attempts still fail with an explicit `PtySpawnError`.

## tests added or updated
- Added `ui/apps/server/src/serverLayers.test.ts` to cover the missing-native-module fallback.
- Re-ran targeted server suites:
  - `bun run test src/serverLayers.test.ts`
  - `bun run test src/main.test.ts`
  - `bun run test src/wsServer.test.ts`
- Re-ran the full release gate:
  - `bash scripts/run-main-pr-checks.sh`

## important decisions
- Kept `scripts/run-main-pr-checks.sh` deterministic with `bun install --ignore-scripts` instead of loosening CI bootstrap just to build `node-pty`.
- Chose lazy terminal failure instead of startup failure so release validation and non-terminal server behavior remain testable on environments without PTY native support.
- Limited the fallback to recoverable `node-pty` load failures and preserved hard failure for unrelated loader errors.

## open loops or known limits
- Environments without Bun PTY support and without working `node-pty` still cannot open live terminal sessions; they now fail at terminal spawn time instead of crashing server startup.
- The public stable release still needs the new `main` push so GitHub Actions can rerun `Release Main Stable` with this fix.
