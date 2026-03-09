# context-engine-001: Deterministic startup context engine

## description
Assemble startup context from manifest, repo state, skills, agents, MCP paths, and memory into deterministic artifacts.

## current implementation state
- Implemented in the workspace bootstrap plugin via `optid-context.md` and startup prompt generation.

## implementation plan
1. Completed: context artifact generation.
2. Completed: memory/skills/agents inventories included.
3. Completed: runner prompt explicitly references generated context.
