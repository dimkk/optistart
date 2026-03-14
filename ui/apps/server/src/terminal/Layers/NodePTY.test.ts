import { FileSystem, Path, Effect } from "effect";
import { assert, it } from "@effect/vitest";

import { ensureNodePtySpawnHelperExecutable, makeNodePtyAdapterLive } from "./NodePTY";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { PtyAdapter, PtySpawnError } from "../Services/PTY";

it.layer(NodeServices.layer)("ensureNodePtySpawnHelperExecutable", (it) => {
  it.effect("adds executable bits when helper exists but is not executable", () =>
    Effect.gen(function* () {
      if (process.platform === "win32") return;

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pty-helper-test-" });
      const helperPath = path.join(dir, "spawn-helper");
      yield* fs.writeFileString(helperPath, "#!/bin/sh\nexit 0\n");
      yield* fs.chmod(helperPath, 0o644);

      yield* ensureNodePtySpawnHelperExecutable(helperPath);

      const mode = (yield* fs.stat(helperPath)).mode & 0o777;
      assert.equal(mode & 0o111, 0o111);
    }),
  );

  it.effect("keeps executable helper as executable", () =>
    Effect.gen(function* () {
      if (process.platform === "win32") return;

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pty-helper-test-" });
      const helperPath = path.join(dir, "spawn-helper");
      yield* fs.writeFileString(helperPath, "#!/bin/sh\nexit 0\n");
      yield* fs.chmod(helperPath, 0o755);

      yield* ensureNodePtySpawnHelperExecutable(helperPath);

      const mode = (yield* fs.stat(helperPath)).mode & 0o777;
      assert.equal(mode & 0o111, 0o111);
    }),
  );

  it.effect("loads node-pty lazily and fails on spawn when native support is unavailable", () =>
    Effect.gen(function* () {
      let importAttempts = 0;

      const error = yield* Effect.gen(function* () {
        const ptyAdapter = yield* PtyAdapter;
        return yield* ptyAdapter.spawn({
          shell: "/bin/sh",
          cwd: process.cwd(),
          cols: 80,
          rows: 24,
          env: process.env,
        });
      }).pipe(
        Effect.provide(makeNodePtyAdapterLive(async () => {
          importAttempts += 1;
          throw new Error("Failed to load native module: pty.node");
        })),
        Effect.flip,
      );

      assert.equal(importAttempts, 1);
      assert.equal(error instanceof PtySpawnError, true);
      assert.equal(error.adapter, "node-pty");
      assert.equal(error.message, "Failed to load node-pty native support.");
    }),
  );
});
