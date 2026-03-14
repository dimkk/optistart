# Task 045 Report

## Implemented Behavior

- changed `optid telegram start` so a start without explicit `threadId` clears any stale pinned session and returns the bridge to auto-target mode

## Tests Added Or Updated

- extended `ui/apps/server/src/optidevPlugins.test.ts` with coverage for clearing stale pinned Telegram targets

## Important Decisions

- explicit session pinning remains supported when a concrete `threadId` is supplied
- plain CLI start now favors correctness over stickiness, because carrying an old hidden pin is what caused Telegram to talk to the wrong session

## Open Loops Or Known Limits

- auto-target still depends on the best available active thread resolution in the Telegram bridge runtime
