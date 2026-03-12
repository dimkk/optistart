# Task 028 Report: runtime-ts-002 slice 7

## Implemented behavior
- Extended `ui/apps/server/src/optidevPlugins.ts` to cover native `skills` and `agents` plugin commands.
- Migrated these plugin actions from Python bridge fallback into the forked `t3` server path:
  - `skills search`
  - `skills install`
  - `agents search`
  - `agents install`
- Native skills support now shells out to the local `npx skills` CLI and installs into `.agents/skills`.
- Native agents support now fetches and parses agent metadata directly and installs markdown into `.agents/agents`.
- With this slice, the current `/optidev` embedded feature set no longer requires Python on the request path.

## Tests added or updated
- Expanded `ui/apps/server/src/optidevPlugins.test.ts` to cover native skills and agents flows.
- Updated `ui/apps/server/src/optidevRoute.test.ts` to verify native skills and agents route handling and to narrow bridge fallback coverage to unknown plugin commands.
- Re-ran colocated server tests, browser `/optidev` tests, and Python compatibility tests.

## Important decisions
- Kept the bridge only as compatibility infrastructure instead of as a default embedded-runtime dependency.
- Preserved native install behavior for both plugin families rather than only migrating search, so the UI path does not bounce back to Python for the first mutating plugin action.
- Continued using the upstream `t3` test style: colocated module tests, minimal route integration, and focused browser regression.

## Open loops or known limits
- Unknown plugin commands still fall back to compatibility infrastructure.
- CLI and non-embedded Python product paths still exist.
- Full retirement of Python from the repository is not complete; this slice removes it from the current embedded `/optidev` hot path.
