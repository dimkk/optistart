# ui-t3code-001: upstream t3code fork for OptiDev

## Summary
Fork upstream `t3code` into this repository and integrate OptiDev into the forked web/server product.

## Behavior
- The repository vendors upstream `t3code` as the actual UI/server base.
- The forked UI exposes the main OptiDev feature surfaces at `/optidev` inside the upstream route tree:
  - projects
  - workspace runtime actions
  - workspace clone
  - memory
  - logs/status
  - plugins and plugin-backed commands
- The forked `t3` server/runtime layer exposes `/api/optidev/health`, `/api/optidev/state`, and `/api/optidev/action`, all handled natively in the TS/Bun runtime.
- E2E covers navigation from the stock `t3` shell into `/optidev` and validates runtime/stateful actions through the embedded native route.

## Notes
- This feature requires a true fork-based integration, not a separate shell inspired by upstream.
- The integration point lives inside the forked `t3` product and no longer relies on a Python bridge on the browser path.
- The fork is vendored directly into `./ui/` as regular repository files, not as a nested git repository.
