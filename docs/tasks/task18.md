# Task 18

## goal
Rework the embedded OptiDev workspace screens so the product reads as manifest-first instead of a bag of controls. The Files tab should render markdown through the existing upstream t3 markdown component path, the OptiDev tab should expose the live workspace manifest as the primary editable source of truth with clear impact notes, memory should explain the current graph-backed state and a practical path toward a visual graph view, and the Plugins tab should be reduced to a simple inventory of current native plugins. Keep Telegram and dev runtime usable while this UI is being simplified.

## architecture
- Reuse the existing forked t3 markdown renderer instead of maintaining a separate OptiDev-only markdown preview path.
- Extend the native `/api/optidev/*` surface with a manifest read/write contract that:
  - reads `.optidev/workspace.yaml`
  - validates and normalizes through the existing native manifest loader
  - returns a human-readable impact preview derived from the resolved manifest fields and current session state
- Keep the manifest schema unchanged; this task is about visibility, editability, and consequence preview, not a manifest redesign.
- Reframe runtime controls as secondary actions that apply the manifest rather than the primary mental model of the screen.
- Keep memory graph implementation incremental:
  - expose current graph-derived summary in a clearer structured way
  - show an explicit implementation plan for a future visual graph
  - do not invent a fake graph UI disconnected from the current memory model
- Replace plugin file editing/config sprawl in the Plugins tab with a stable native plugin inventory view based on the built-in plugin command set and current Telegram bridge state.

## atomic features
- `repo-files-002`:
  Switch the Files markdown preview to the shared t3 markdown component so OptiDev stops carrying a thinner custom renderer.
- `runtime-session-002`:
  Make the OptiDev workspace manifest-first with live manifest read/edit/save, impact preview, clearer session/runtime context, and a concrete graph-memory implementation plan.
- `plugins-config-001`:
  Simplify the Plugins surface to a current-plugin inventory with status instead of inline file editing and configuration forms.

## test plan
- Unit:
  Cover manifest read/write validation, impact preview generation, and plugin inventory shaping.
- Integration:
  Validate the live `/api/optidev/*` manifest and plugin inventory endpoints over the native route server.
- E2E:
  Update the browser route coverage for Files markdown rendering, manifest save/impact feedback, and simplified plugin inventory behavior.
- Runtime verification:
  Start the local dev server, open `/optidev`, confirm manifest edits round-trip through `.optidev/workspace.yaml`, and confirm Telegram can still be enabled through the native runtime after the UI simplification.

## approvals / notes
- User explicitly asked on 2026-03-13 to proceed with these OptiDev workspace screen changes, so this dossier acts as the required control point before implementation.
- T3-first decision: reuse the existing shared `ChatMarkdown` renderer and native `/api/optidev/*` server path instead of introducing parallel OptiDev-only markdown or manifest stacks.
- Memory graph scope in this task is implementation direction plus structured UI context, not a full node-link canvas.
