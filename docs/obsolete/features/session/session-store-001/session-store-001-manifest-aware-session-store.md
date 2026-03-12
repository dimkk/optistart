# session-store-001: Manifest-aware session store

## description
Store live runtime state separately from manifest desired state in project-local `.optidev/session.json`.

## current implementation state
- Implemented through `optidev/runtime_session.py` and app lifecycle updates.

## implementation plan
1. Completed: project-local session model.
2. Completed: session save/load/reset helpers.
3. Completed: stop lifecycle updates.
