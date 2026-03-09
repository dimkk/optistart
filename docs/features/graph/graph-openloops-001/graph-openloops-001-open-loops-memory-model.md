# graph-openloops-001: Open loops memory model

## description
Track unresolved work so restore and inspection flows surface unfinished engineering context.

## current implementation state
- Implemented in the native TS/Bun memory layer in `ui/apps/server/src/optidevMemory.ts`.
- Open loops are stored with feature scope, description, and status.
- `optid memory open-loops` filters unresolved entries for the active project.

## implementation plan
1. Completed: open-loop schema and persistence.
2. Completed: unresolved-only query path.
3. Completed: startup digest and CLI output coverage.
