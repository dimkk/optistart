# graph-decisions-001: Decision memory model

## description
Persist key development decisions so future runs can recover reasoning, not only outcomes.

## current implementation state
- Implemented in the native TS/Bun memory layer in `ui/apps/server/src/optidevMemory.ts`.
- Decision records support title, decision, rationale, and alternatives.
- `optid memory show feature <id>` renders stored decision details when present.

## implementation plan
1. Completed: decision record schema.
2. Completed: feature-to-decision persistence.
3. Completed: memory lookup output for decision details.
