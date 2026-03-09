# cli-init-001: Project initialization command

## description
Add `optid init <name|.>` to initialize a project quickly.

Behavior:
- `optid init <name>`: create `<cwd>/<name>`, initialize `.project/config.yaml`, register project in discovery registry.
- `optid init .`: initialize project in current directory, keep shell cwd unchanged.

## current implementation state
- CLI command `init` is implemented and released in `v1-1`.
- `optid init <name>` creates a project directory in current path, initializes `.project/config.yaml`, and registers it for discovery.
- `optid init .` initializes current directory and registers it by folder name.
- Registry uses symlink by default and falls back to `.optid-target` pointer file when symlink is unavailable.
- Unit/integration/e2e tests are added and passing.

## implementation plan
1. Completed: added `init` command in CLI dispatch and usage.
2. Completed: app-level init flow with project bootstrap metadata.
3. Completed: initialized project registration in discovery root.
4. Completed: symlink fallback via pointer file for restricted environments.
5. Completed: unit/integration/e2e tests.
