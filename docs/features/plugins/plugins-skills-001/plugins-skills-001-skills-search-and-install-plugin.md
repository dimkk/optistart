# plugins-skills-001: Skills search and install plugin

## Description
Add a built-in plugin for searching skills through `skills.sh` / `npx skills`
and installing selected skills into the current project under `.agents/skills/`.

## Current implementation state
- `optid skills search ...` is routed through the plugin manager.
- `optid skills install ...` installs into project-local `.agents/skills/`.
- Source-specific behavior is implemented through `NpxSkillsProvider`.
- Repeated installs are idempotent.

## Implementation plan
1. Expose `skills search` and `skills install` through plugin command routing.
2. Use `npx skills find` for search and parse terminal output.
3. Install skills into a temporary `CODEX_HOME`, then copy them into `.agents/skills/`.
4. Make repeated installs idempotent.
5. Add unit/integration/e2e coverage for search, install, and CLI routing.

## Extension points
- User-facing command stays stable at `optid skills ...`.
- Source-specific behavior is isolated behind `NpxSkillsProvider` in `optidev/plugins/skills.py`.
- Replacing `skills.sh` means swapping provider selection, not rewriting CLI or workspace flow.
