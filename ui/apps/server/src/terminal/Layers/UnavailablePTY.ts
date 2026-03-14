import { Effect, Layer } from "effect";

import { PtyAdapter, PtySpawnError, type PtyAdapterShape } from "../Services/PTY";

export function makeUnavailablePtyAdapterLive(message: string) {
  return Layer.succeed(PtyAdapter, {
    spawn: () =>
      Effect.fail(
        new PtySpawnError({
          adapter: "unavailable",
          message,
        }),
      ),
  } satisfies PtyAdapterShape);
}
