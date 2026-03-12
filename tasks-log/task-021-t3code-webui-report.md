# Task 021 Report: t3code Fork Integration

## Implemented behavior
- Replaced the separate OptiDev browser shell direction with a real upstream `t3code` fork vendored under `ui/`.
- Added an OptiDev bridge route inside the forked server at `ui/apps/server/src/optidevRoute.ts`.
- Added a long-lived bridge manager at `ui/apps/server/src/optidevBridge.ts` and a formal Python daemon at `optidev/daemon.py` so the forked server reuses one OptiDev service process instead of spawning a fresh interpreter for every browser action.
- Exposed OptiDev inside the forked web product at `/optidev`, reachable from the stock thread shell.
- Wired the forked server route to OptiDev through a persistent `uv`-backed daemon and the Python-side UI dispatch helpers instead of parsing human CLI output or embedding Python scripts in TypeScript.
- The integrated UI now covers:
  - discovered projects with resolved paths
  - runtime lifecycle actions
  - workspace clone
  - memory summary, open loops, and typed lookups
  - status and logs
  - plugin-backed actions for advice, Telegram, skills, and agents
- Removed the standalone `optid ui` path and deleted the old `optidev.webui` test surface so the product exposes one browser UI architecture.

## Tests added or updated
- Kept backend helper coverage with `tests/unit/test_ui_api.py`.
- Added fork-server coverage in `ui/apps/server/src/optidevBridge.test.ts` and `ui/apps/server/src/optidevRoute.test.ts`, plus Python daemon coverage in `tests/unit/test_daemon.py`.
- Added browser e2e in `ui/apps/web/src/routes/-optidev.browser.tsx`.
- Re-ran targeted Python CLI/helper tests after removing `optid ui`.

## Important decisions
- Treat upstream `t3code` as the real product shell and integrate OptiDev into its server/web layers instead of maintaining a parallel Bun/Vite app.
- Keep OptiDev runtime/core authoritative in Python, but expose it through structured JSON bridge calls from the forked `t3` server and reuse one long-lived bridge process per server/runtime root.
- Resolve the OptiDev repo root dynamically so the fork works whether `t3` is started from the repository root, `ui/`, or a nested server directory.

## Open loops or known limits
- The current bridge is long-lived inside the `t3` server process, but it is still a separate Python subprocess rather than a native in-process runtime.
- Upstream-wide `apps/server` typecheck still has unrelated baseline issues in this environment, so validation here is anchored on the new route tests plus the web build and browser e2e.
