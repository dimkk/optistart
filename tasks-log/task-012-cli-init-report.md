# Task Report: cli-init-001

## Feature
- ID: `cli-init-001`
- Title: CLI project initialization command
- Final status: `DONE`
- Release: `v1-0`

## Implemented behavior
- Added `optid init <name|.>` command.
- `optid init <name>`:
  - creates `<cwd>/<name>`
  - creates `<cwd>/<name>/.project/config.yaml`
  - registers project in configured discovery root
- `optid init .`:
  - initializes current directory
  - registers it by current folder name
- Registry mapping behavior:
  - prefer symlink in discovery root
  - fallback to `.optid-target` pointer file when symlink is unavailable
- CLI output now clearly states that shell directory is unchanged and prints `cd` hint.

## Files changed
- `optidev/cli.py`
- `optidev/app.py`
- `optidev/discovery.py`
- `tests/unit/test_cli.py`
- `tests/integration/test_cli_workspace.py`
- `tests/e2e/test_cli_module_entrypoint.py`
- `docs/v1-1/features-matrix.md`
- `docs/v1-1/test-matrix.md`
- `docs/features/cli/cli-init-001/cli-init-001-project-initialization-command.md`

## Tests
Command:
```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Result:
- Passed: 47
- Failed: 0
- Errors: 0

## Problems encountered
- E2E tests for `init` failed when subprocess `cwd` was outside repo root because `python -m optidev` could not resolve module path.

## Resolutions
- Added `PYTHONPATH` setup in those e2e tests to include repository root.
