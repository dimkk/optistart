# cli-runner-002: runner session inventory

## summary
`optid runner ls` lists the currently open live runner sessions from the running OptiDev server.

## contract
- Output is ordered by newest live session activity first.
- Each row exposes:
  - ordinal alias starting at `1`
  - runner type
  - canonical thread guid
  - best available cwd
  - latest user-authored phrase preview
- The inventory is built from:
  - `ProviderService.listSessions()` on the live server for open session membership, runner type, cwd, and last-seen ordering
  - orchestration projection snapshot for message preview and cwd fallback

## notes
- The alias is ephemeral and recomputed from the latest inventory.
- The CLI inventory is server-backed so `runner ls` reflects the same live session set the integrated runtime is holding, rather than a persisted sqlite subset.
- The current shipped implementation surfaces live Codex-backed sessions through the runner-generic CLI name.
