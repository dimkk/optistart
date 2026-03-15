import { afterEach, describe, expect, it, vi } from "vitest";

import { syncActiveOptiDevThread } from "./optidevActiveThread";

describe("optidevActiveThread", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("posts the selected thread guid and title to the OptiDev active-thread endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, lines: ["Active thread recorded."] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await syncActiveOptiDevThread({
      threadId: "thread-alpha",
      threadTitle: "Alpha session",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/optidev/active-thread",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: "thread-alpha",
          threadTitle: "Alpha session",
        }),
      }),
    );
  });
});
