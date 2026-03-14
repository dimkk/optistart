# cli-core-001: Core CLI command surface

## description
Implement the first working CLI contract for `optid` with commands:
- `optid <project>`
- `optid stop`
- `optid status`
- `optid logs`
- `optid projects`

The command surface must be deterministic and callable from terminal entrypoint.

## current implementation state
- Implemented as a native Bun CLI entrypoint in `ui/apps/server/src/optidevCli.ts`, exposed through the root shim `scripts/optid`.
- Command surface implemented:
  - start: `optid <project>`
  - service commands: `stop`, `status`, `logs`, `projects`
- `optid start` and `optid go` now enable startup repo advice by default, with `--no-advice` as the explicit opt-out.
- Workspace state persisted in `~/.optidev` (or `OPTIDEV_HOME` override).
- Runtime/session behavior is shared with the native TS/Bun `/optidev` route instead of a separate Python CLI core.
- Test suite is colocated in the forked server layer via `optidevCli.test.ts` and `optidevCliShim.test.ts`.

## implementation plan
1. Completed: Bun-native entrypoint and CLI dispatcher.
2. Completed: workspace/session service integration with state persistence.
3. Completed: CLI runs on the same native TS/Bun runtime modules used by `/optidev`.
4. Completed: colocated unit/integration smoke coverage.
5. Completed: feature moved to `DONE` with report.
