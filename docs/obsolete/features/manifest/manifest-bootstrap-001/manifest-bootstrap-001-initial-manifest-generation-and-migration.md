# manifest-bootstrap-001: Initial manifest generation and migration

## description
Generate an initial manifest for repositories that only have legacy `.project/config.yaml` state.

## current implementation state
- Implemented through `ensure_workspace_manifest(...)` in `optidev/manifest.py` and init/start integration.

## implementation plan
1. Completed: initial manifest generation from project config.
2. Completed: automatic creation during init/start.
3. Completed: migration remains compatible with legacy repositories.
