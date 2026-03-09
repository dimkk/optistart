# graph-summary-001: Startup memory digest generation

## description
Generate a compact project-memory digest for startup and restore flows.

## current implementation state
- Implemented in `ui/apps/server/src/optidevMemory.ts` and consumed by `ui/apps/server/src/optidevStartup.ts`.
- Digest includes release, active feature, last completed feature, open loops, key decisions, and next suggested action.
- Digest is rendered in CLI output and passed into workspace bootstrap context.

## implementation plan
1. Completed: digest builder.
2. Completed: human-readable digest rendering.
3. Completed: integration into `start`, `resume`, and `memory` commands.
