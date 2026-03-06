# cfg-load-001: Config loading and validation

## description
Implement configuration loading for:
- global config: `~/.optidev/config.yaml`
- project config: `<project>/.project/config.yaml`

Provide schema defaults, validation, and actionable startup errors for invalid config.

## current implementation state
- Dedicated config module implemented in `optidev/config.py`.
- Global config loading implemented (`~/.optidev/config.yaml`) with defaults and validation.
- Project config loading implemented (`<project>/.project/config.yaml`) with nested section validation.
- Effective config merge implemented with `load_effective_config(...)`.
- CLI startup now returns actionable error messages on invalid config via `Config error: ...`.

## implementation plan
1. Completed: config module with dataclass schemas and validation helpers.
2. Completed: global config defaults and strict validation.
3. Completed: project config loading and nested sections validation.
4. Completed: merged effective config structure.
5. Completed: startup flow fails with actionable config errors.
6. Completed: unit/integration/e2e tests added and passing.
