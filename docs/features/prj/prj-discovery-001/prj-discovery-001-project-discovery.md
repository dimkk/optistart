# prj-discovery-001: Project discovery

## description
Implement project discovery for `optid` from:
- configured projects directory (`~/.optidev/projects` by default)
- optional scan directories (`~/dev`, `~/projects` by default)

Support project resolution by name for startup flow and listing projects via `optid projects`.

## current implementation state
- Implemented multi-root discovery with deterministic precedence and deduplication.
- Added discovery APIs:
  - `discovery_roots(...)`
  - `discover_projects(...)`
  - `list_projects(...)`
  - `resolve_project(...)`
- `OptiDevApp.start_project()` now resolves project by name before workspace start.
- Environment overrides supported:
  - `OPTIDEV_PROJECTS_DIR`
  - `OPTIDEV_SCAN_PATHS` (colon-separated)
- Test coverage added across unit/integration/e2e and passing.

## implementation plan
1. Completed: discovery roots builder with precedence and deduplication.
2. Completed: project records scanning from multiple roots.
3. Completed: `resolve_project(name)` helper.
4. Completed: startup flow now validates project existence via discovery.
5. Completed: unit/integration/e2e tests for discovery and `optid projects`.
