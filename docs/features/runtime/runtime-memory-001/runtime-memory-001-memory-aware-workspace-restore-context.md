# runtime-memory-001: Memory-aware workspace restore context

## description
Inject structured project memory into workspace startup, restore messaging, and runner bootstrap context.

## current implementation state
- Implemented in `ui/apps/server/src/optidevStartup.ts` and `ui/apps/server/src/optidevMemory.ts`.
- Start and resume flows ingest the graph, build a digest, print it to CLI, and place it into `optid-context.md` and the runner startup prompt.
- Workspace bootstrap uses the digest to guide startup behavior before feature work begins.

## implementation plan
1. Completed: ingest-before-start runtime hook.
2. Completed: digest propagation into CLI output and startup context files.
3. Completed: e2e coverage for startup and resume digest visibility.
