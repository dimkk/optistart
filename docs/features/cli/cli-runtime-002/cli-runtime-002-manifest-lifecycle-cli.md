# cli-runtime-002: Manifest lifecycle CLI

## description
Expose manifest-native lifecycle commands such as `resume`, `reset`, and `workspace clone`.

## current implementation state
- Implemented in `ui/apps/server/src/optidevCli.ts` on top of the native TS/Bun lifecycle modules.

## implementation plan
1. Completed: `resume` command.
2. Completed: `reset` command.
3. Completed: `workspace clone <name>` command.
4. Completed: native CLI coverage via colocated `optidevCli.test.ts` and root-shim smoke coverage via `optidevCliShim.test.ts`.
