import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeTerminalPtyAdapterLayer } from "./serverLayers";
import { PtyAdapter, PtySpawnError } from "./terminal/Services/PTY";

describe("serverLayers", () => {
  it("falls back to an unavailable PTY adapter when node-pty native bindings are missing", async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const ptyAdapter = yield* PtyAdapter;
        return yield* ptyAdapter.spawn({
          shell: "/bin/sh",
          cwd: process.cwd(),
          cols: 80,
          rows: 24,
          env: process.env,
        });
      }).pipe(
        Effect.provide(
          makeTerminalPtyAdapterLayer(async () => {
            throw new Error(
              "Failed to load native module: pty.node, checked prebuilds/linux-x64/pty.node",
            );
          }),
        ),
        Effect.flip,
      ),
    );

    expect(error).toBeInstanceOf(PtySpawnError);
    expect(error.message).toContain("node-pty failed to load");
    expect(error.message).toContain("Terminal PTY support is unavailable");
  });
});
