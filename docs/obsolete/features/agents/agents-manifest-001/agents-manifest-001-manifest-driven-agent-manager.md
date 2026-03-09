# agents-manifest-001: Manifest-driven agent manager

## description
Resolve declared agents from manifest context, validate definitions, and persist active agent runtime metadata.

## current implementation state
- Implemented through `optidev/agent_manager.py`, startup validation, and `agents.json` session artifact generation.

## implementation plan
1. Completed: manifest agent resolution against `.agents/agents`.
2. Completed: startup validation for declared agents.
3. Completed: active agent runtime artifact generation.
