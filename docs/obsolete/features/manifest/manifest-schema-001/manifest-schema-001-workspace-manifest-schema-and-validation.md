# manifest-schema-001: Workspace manifest schema and validation

## description
Define and validate `.optidev/workspace.yaml` as the primary desired-state model for OptiDev workspaces.

## current implementation state
- Implemented in `optidev/manifest.py` with typed dataclasses for workspace, agents, layout, services, tests, logs, and context.
- Manifest generation now records git branch and last known HEAD commit.
- Invalid manifest shapes fail startup with actionable config errors.

## implementation plan
1. Completed: manifest schema and defaults.
2. Completed: loader and validation helpers.
3. Completed: invalid-manifest test coverage.
