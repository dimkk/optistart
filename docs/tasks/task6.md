# Task 6

## goal
Pivot from the experimental terminal TUI path to a real upstream `t3code` fork and integrate the OptiDev feature set into that fork with end-to-end coverage.

## architecture
- Vendor the upstream `t3code` repository into this repository as the actual UI/server fork base.
- Perform OptiDev integration inside the forked `t3` structure instead of maintaining a separate standalone shell.
- Keep OptiDev runtime/core as the product backend source of truth while exposing it through forked `t3` web/server surfaces.
- Keep a long-lived OptiDev daemon process behind a formal JSON request/response protocol so browser actions do not pay full Python startup cost on every request and the runtime contract lives in Python instead of embedded TypeScript script strings.
- Adapt the forked `t3` web application to expose OptiDev feature surfaces:
  - projects
  - workspace runtime lifecycle
  - memory
  - status/logs
  - plugin-backed integrations
- Adapt the forked `t3` server/runtime layer to talk to OptiDev services and commands.
- Cover the integrated fork with browser e2e.

## atomic features
- `ui-t3code-001`:
  Fork upstream `t3code` into the repository and integrate OptiDev features into the forked web/server product.

## test plan
- Unit:
  Fork integration helpers and OptiDev bridge logic.
- Integration:
  Forked `t3` server/runtime integration over OptiDev services.
- E2E:
  Browser flows inside the forked `t3` UI for project listing, start/stop/status, memory views, plugin command surfaces, and workspace actions.

## approvals / notes
- User explicitly requested a pivot from the Textual/TUI direction to `https://github.com/pingdotgg/t3code`.
- User then clarified that an embedded shell is not acceptable: this must be a real upstream fork and OptiDev must integrate into `t3` itself.
- Upstream `t3code` is a Bun/TypeScript web/server/desktop product, so the fork integration is materially larger than the previous shell approach.
