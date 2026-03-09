# cli-memory-001: Memory inspection CLI

## description
Expose structured project memory through first-class CLI commands.

## current implementation state
- Implemented in `ui/apps/server/src/optidevCli.ts` over the native memory runtime in `ui/apps/server/src/optidevMemory.ts`.
- Supports `optid memory`, `optid memory show [feature|task|release] <id>`, and `optid memory open-loops`.
- All commands read through the graph-store abstraction.

## implementation plan
1. Completed: CLI parsing and usage wiring.
2. Completed: app service methods for summary and typed lookups.
3. Completed: integration and e2e coverage for feature, task, release, and open-loops queries.
