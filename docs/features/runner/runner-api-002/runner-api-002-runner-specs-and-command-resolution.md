# runner-api-002: Runner specs and command resolution cleanup

## description
Replace placeholder runner adapter methods with meaningful runner specs that own default chat command resolution and bootstrap metadata.

## current implementation state
- Native runner selection and command resolution live in `ui/apps/server/src/optidevStartup.ts`.
- Default chat command resolution is rendered into the generated startup scripts and persisted in `runner.json`.
- `runner.json` now persists both selected runner name and resolved default command.

## implementation plan
1. Completed: define runner spec model.
2. Completed: move default command generation into runner layer.
3. Completed: keep bootstrap metadata generation in the runner manager with updated tests.
