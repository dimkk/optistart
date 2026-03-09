# runtime-ts-003: native-only repository cleanup

## Summary
Remove the dormant Python OptiDev package and Python test suite after the TS/Bun runtime and Bun CLI become the only shipped execution path.

## Behavior
- Repository root detection no longer depends on the presence of `optidev/`.
- The shipped `optid` entrypoint stays `scripts/optid`, backed by `ui/apps/server/src/optidevCli.ts`.
- Current release docs and test matrices point to native TS/Bun modules and colocated `t3`-style tests.
- Historical reports may still mention the old migration path, but current user-facing docs and release control files describe only the native runtime.

## Notes
- `.optidev/*`, `~/.optidev/*`, and CLI/UI contracts remain stable.
- This cleanup removes dormant implementation artifacts, not product capabilities.
