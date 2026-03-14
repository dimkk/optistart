# ui-shell-003: Manifest-first OptiDev workspace

## Summary
Reframe the embedded `/optidev` workspace around `.optidev/workspace.yaml` as the primary contract, with runtime controls demoted to actions that apply the saved manifest to the live workspace.

## Behavior
- The `OptiDev` tab reads and displays the current workspace manifest from `.optidev/workspace.yaml`.
- The manifest is editable directly in the UI and can be saved back through the native TS/Bun route.
- The UI previews runtime-visible impact before save/apply by comparing:
  - the current saved manifest
  - the draft manifest
  - the live local session contract from `.optidev/session.json` when present
- Runtime notes explicitly explain why `start`, `resume`, `reset`, `stop`, and `workspace clone` still exist in a manifest-first product.
- The `Memory` section exposes a graph-backed payload with node/edge counts, graph implementation notes, and typed lookup actions instead of pretending a full visual graph already exists.
- The `Plugins` tab is intentionally reduced to a live native inventory of `advice`, `telegram`, `skills`, and `agents`.
- The `Files` tab renders markdown through the shared t3 markdown component path instead of an OptiDev-only renderer.

## Native Route Contract
- `GET /api/optidev/manifest`
- `POST /api/optidev/manifest`
- `POST /api/optidev/manifest/impact`
- `GET /api/optidev/memory-graph`
- `GET /api/optidev/plugins`

## Notes
- This feature does not redesign the manifest schema; it makes the existing manifest visible, editable, and consequence-aware.
- The current memory graph view uses deterministic layout data so a future visual graph can preserve filters, selection, and pinned nodes by stable node ID.
- Plugin editing was intentionally removed from the primary workspace path because it obscured the runtime contract and mixed unrelated concerns.
