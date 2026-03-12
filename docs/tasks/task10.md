# Task 10

## goal
Turn OptiDev into a first-class surface inside the existing `t3code` shell, eliminate the current standalone `/optidev` page behavior that causes confusing navigation and broken scrolling, and reshape the UI around developer pain relief instead of feature dumping.

## architecture
- Build OptiDev as a separate component surface mounted into the existing `t3` product, not as a rewrite of existing `t3` shell components.
- Limit changes to existing `t3` UI to small integration points only:
  - one sidebar/navigation entry
  - one route mount
  - any required API registration
- Keep new UI code isolated under OptiDev-owned modules so the existing `t3` chat/thread components keep their current behavior.
- Make OptiDev a normal destination inside the existing `t3` navigation/sidebar instead of an isolated landing page with its own full-screen layout.
- Replace the current single long page with a 3-tab information architecture inside the existing shell:
  - `Files`: current repository tree plus a simple viewer for the selected file.
  - `OptiDev`: session status, manifest/restore/runtime controls, and repository state.
  - `Plugins`: agents, skills, and Telegram configuration files with lightweight editing.
- Keep `/api/optidev/*` native-only on TS/Bun and add read/write endpoints only where the new UI actually needs them.
- File viewing contract:
  - repository-root scoped, no path traversal
  - markdown supports rendered mode and raw/source mode
  - images render inline
  - code/text render in a readable viewer with syntax highlighting
- Prefer reuse of existing `t3` shell primitives such as sidebar, scroll containers, and route layout over inventing a second shell inside `/optidev`, but consume them from separate OptiDev-owned components rather than editing core `t3` components in place.
- Fix the current loading/scroll issues as part of the shell rewrite instead of patching the old page in place.

## atomic features
- `ui-shell-002`:
  Embed OptiDev into the existing `t3code` shell/sidebar, replace the standalone layout, and fix route loading and scroll behavior.
- `repo-files-002`:
  Add a repository-scoped file explorer and viewer for folders, markdown, images, and source code.
- `runtime-session-002`:
  Expose session parameters, restore state, manifest/runtime status, and related OptiDev controls in a dedicated session tab.
- `plugins-config-001`:
  Add plugin/config management for `.agents/agents`, `.agents/skills`, and Telegram-related configuration files from the integrated UI.

## test plan
- Unit:
  Add colocated `vitest` module tests for file-tree shaping, safe path resolution, markdown/viewer mode selection, session-state shaping, and plugin config read/write helpers.
- Integration:
  Add live HTTP route tests for new file-browser and config-edit endpoints, keeping the route tests in the same `t3` style already used in `ui/apps/server/src/*.test.ts`.
- E2E:
  Expand the browser route suite to cover sidebar navigation into OptiDev, file browsing, markdown rendered/source toggle, image and code viewing, session/restore actions, and plugin file editing flows.
- Regression:
  Explicitly cover the currently reported failures:
  - confusing `Open` entry behavior
  - broken downward scrolling
  - `Status` stuck on `Loading...`

## approvals / notes
- User requested the new architecture on 2026-03-09 with these constraints:
  - OptiDev should live in the existing `t3` sidebar
  - the UI should be split into `Files`, `OptiDev`, and `Plugins`
  - the file tab must show the current folder tree and support simple viewing for markdown, images, and code
  - the plugins tab must manage agent files, skill files, and Telegram settings
  - the implementation should be a separate integrated component, not a rewrite of existing `t3` components
- This is a cross-cutting UI/runtime/API task, so implementation should start only after the dossier is explicitly approved.
