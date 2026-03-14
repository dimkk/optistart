# task20

## goal
- Fix the stable release blocker where GitHub Actions server validation fails before test execution because `node-pty` native bindings are unavailable in CI.
- Keep the shared `main` validation path green without requiring the entire server runtime to crash on startup when PTY native support is missing.

## architecture
- Move server PTY adapter selection behind a runtime-resolved layer instead of static eager imports.
- Move `node-pty` loading inside the Node PTY adapter spawn path so constructing the server layer never requires native PTY support up front.
- Prefer Bun PTY when the runtime exposes Bun terminal support.
- On non-Bun runtimes, try loading the Node PTY adapter dynamically.
- If `node-pty` cannot load, provide an explicit unavailable PTY adapter that fails only on `terminal.open` instead of crashing unrelated server startup and tests.

## atomic features
- Add a CI-safe PTY adapter selection path in `serverLayers`.
- Add an unavailable PTY adapter layer with a clear terminal spawn error.
- Add regression coverage proving the fallback path builds and fails lazily at spawn time.

## test plan
- Add/extend unit coverage for PTY adapter selection fallback.
- Add/extend unit coverage proving the Node PTY service itself only loads native support on `spawn`.
- Run targeted server tests covering the release blocker:
  - `ui/apps/server/src/terminal/Layers/NodePTY.test.ts`
  - `ui/apps/server/src/serverLayers.test.ts`
  - `ui/apps/server/src/main.test.ts`
  - `ui/apps/server/src/wsServer.test.ts`
- Re-run `bash scripts/run-main-pr-checks.sh`.

## approvals / notes
- Release blocker fix requested directly by the user after a broken public `main` release attempt, so no extra approval round is required.
