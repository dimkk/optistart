# manifest-load-001: Workspace loader

## description
Add loader helpers for `.optidev/workspace.yaml` and typed manifest access for agents, services, tests, logs, context, and workspace metadata.

## current implementation state
- Implemented through `optidev/manifest.py` with typed dataclasses and loader helpers.

## implementation plan
1. Completed: manifest file resolution and loading.
2. Completed: typed accessors via dataclasses.
3. Completed: integration into app start flow.
