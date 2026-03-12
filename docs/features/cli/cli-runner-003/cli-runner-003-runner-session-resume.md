# cli-runner-003: runner session resume

## summary
`optid runner resume <id>` resolves an operator alias from `optid runner ls` and resumes the matching thread through the live OptiDev server.

## contract
- The CLI resolves numeric `<id>` against the current live inventory and forwards the canonical thread guid to `/api/optidev/action` with `action=runner_resume`.
- The CLI may also forward a canonical thread guid directly when the caller already knows it.
- The live server:
  - returns the already-active session if the thread is already attached
  - otherwise reads the persisted provider binding and resume cursor
  - restarts the provider session with the persisted cwd/runtime mode
- Failure modes are explicit:
  - unknown alias
  - missing persisted binding
  - missing resume cursor
  - OptiDev server not reachable

## notes
- `resume` is intentionally server-backed so the restored runner stays attached to the live `t3code`/OptiDev process instead of a one-shot CLI shell.
