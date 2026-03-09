# graph-store-001: Memory graph storage abstraction

## description
Define a backend-agnostic graph store contract for structured project memory.

## current implementation state
- Implemented in the native memory model and query helpers under `ui/apps/server/src/optidevMemory.ts`.
- Runtime and CLI call the graph store through the abstract interface.
- Unsupported backends fail fast with a config error.

## implementation plan
1. Completed: graph store protocol for tasks, features, releases, decisions, open loops, and sessions.
2. Completed: factory wiring for backend selection.
3. Completed: unit coverage for backend selection and contract usage.
