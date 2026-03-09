# plugins-agents-001: Agents search and install plugin

## Description
Add a built-in plugin for searching public agent listings and installing agent
definitions into the current project under `.agents/agents/`.

## Current implementation state
- `optid agents search ...` is routed through the plugin manager.
- `optid agents install ...` installs into project-local `.agents/agents/`.
- Catalog-specific behavior is implemented through `AiAgentsListProvider`.
- Repeated installs are idempotent.

## Implementation plan
1. Expose `agents search` and `agents install` through plugin command routing.
2. Search `aiagentslist.com` with query requests and parse top results.
3. Fetch agent metadata from detail pages and generate markdown agent definitions.
4. Make repeated installs idempotent.
5. Add unit/integration/e2e coverage for parsing, install, and CLI routing.

## Extension points
- User-facing command stays stable at `optid agents ...`.
- Catalog-specific behavior is isolated behind `AiAgentsListProvider` in `optidev/plugins/agents.py`.
- Replacing `aiagentslist.com` means swapping provider selection, not rewriting CLI or workspace flow.
