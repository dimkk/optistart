import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  MessageId,
  ProjectId,
  ThreadId,
  type OrchestrationEvent,
  type OrchestrationReadModel,
} from "@t3tools/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OptiDevRouteContext } from "./optidevContract";
import {
  resolveTelegramTargetThread,
  startOptiDevTelegramBridgeRuntime,
} from "./optidevTelegramBridge";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeContext(homeDir: string, cwd: string): OptiDevRouteContext {
  return { homeDir, cwd };
}

function seedTelegramConfig(homeDir: string, config?: Partial<{
  enabled: boolean;
  token: string;
  chat_id: number | null;
  updated_at: string;
}>): void {
  fs.mkdirSync(path.join(homeDir, "plugins"), { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, "plugins", "telegram-config.json"),
    JSON.stringify(
      {
        enabled: true,
        token: "123456:ABCDEF",
        chat_id: 42,
        updated_at: "2026-03-13T00:00:00.000Z",
        ...config,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function seedTelegramState(homeDir: string, lastUpdateId: number): void {
  fs.mkdirSync(path.join(homeDir, "plugins"), { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, "plugins", "telegram-bridge-state.json"),
    JSON.stringify(
      {
        lastUpdateId,
        updatedAt: "2026-03-13T00:00:00.000Z",
      },
      null,
      2,
    ),
    "utf8",
  );
}

function seedActiveSession(homeDir: string, project: string, status = "running"): void {
  fs.writeFileSync(
    path.join(homeDir, "active_session.json"),
    JSON.stringify({ project, status }, null, 2),
    "utf8",
  );
}

function makeSnapshot(overrides?: Partial<OrchestrationReadModel>): OrchestrationReadModel {
  const projectId = ProjectId.makeUnsafe("project-1");
  const threadAlpha = ThreadId.makeUnsafe("thread-alpha");
  const threadBeta = ThreadId.makeUnsafe("thread-beta");
  return {
    snapshotSequence: 1,
    updatedAt: "2026-03-13T00:00:00.000Z",
    projects: [
      {
        id: projectId,
        title: "demo",
        workspaceRoot: "/repo/demo",
        defaultModel: "gpt-5-codex",
        scripts: [],
        createdAt: "2026-03-13T00:00:00.000Z",
        updatedAt: "2026-03-13T00:00:00.000Z",
        deletedAt: null,
      },
    ],
    threads: [
      {
        id: threadAlpha,
        projectId,
        title: "Older thread",
        model: "gpt-5-codex",
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        latestTurn: null,
        createdAt: "2026-03-13T00:00:00.000Z",
        updatedAt: "2026-03-13T00:00:01.000Z",
        deletedAt: null,
        messages: [],
        proposedPlans: [],
        activities: [],
        checkpoints: [],
        session: {
          threadId: threadAlpha,
          status: "ready",
          providerName: "codex",
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: "2026-03-13T00:00:01.000Z",
        },
      },
      {
        id: threadBeta,
        projectId,
        title: "Newest active thread",
        model: "gpt-5-codex",
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        latestTurn: null,
        createdAt: "2026-03-13T00:00:00.000Z",
        updatedAt: "2026-03-13T00:00:02.000Z",
        deletedAt: null,
        messages: [],
        proposedPlans: [],
        activities: [],
        checkpoints: [],
        session: {
          threadId: threadBeta,
          status: "running",
          providerName: "codex",
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: "2026-03-13T00:00:02.000Z",
        },
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("optidevTelegramBridge", () => {
  it("resolves the freshest active thread for the active OptiDev project", async () => {
    const homeDir = makeTempDir("optidev-telegram-home-");
    const context = makeContext(homeDir, "/repo/demo");
    seedActiveSession(homeDir, "demo");

    const thread = await resolveTelegramTargetThread({
      context,
      snapshot: makeSnapshot(),
    });

    expect(thread?.id).toBe("thread-beta");
  });

  it("prefers the last explicitly enabled thread when it still exists", async () => {
    const homeDir = makeTempDir("optidev-telegram-home-");
    const context = makeContext(homeDir, "/repo/demo");
    seedActiveSession(homeDir, "demo");

    const thread = await resolveTelegramTargetThread({
      context,
      snapshot: makeSnapshot(),
      preferredThreadId: "thread-alpha",
    });

    expect(thread?.id).toBe("thread-alpha");
  });

  it("does not fall back to another thread when the preferred thread is missing", async () => {
    const homeDir = makeTempDir("optidev-telegram-home-");
    const context = makeContext(homeDir, "/repo/demo");
    seedActiveSession(homeDir, "demo");

    const thread = await resolveTelegramTargetThread({
      context,
      snapshot: makeSnapshot(),
      preferredThreadId: "thread-missing",
    });

    expect(thread).toBeNull();
  });

  it("bridges inbound telegram text into thread.turn.start and sends assistant replies back", async () => {
    const homeDir = makeTempDir("optidev-telegram-home-");
    const context = makeContext(homeDir, "/repo/demo");
    seedActiveSession(homeDir, "demo");
    seedTelegramConfig(homeDir);
    seedTelegramState(homeDir, 100);

    const dispatched: unknown[] = [];
    const sentMessages: string[] = [];
    let getUpdatesCalls = 0;

    const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = url.split("/").at(-1);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (method === "getUpdates") {
        getUpdatesCalls += 1;
        return new Response(
          JSON.stringify({
            ok: true,
            result:
              getUpdatesCalls === 1
                ? [
                    {
                      update_id: 101,
                      message: {
                        message_id: 1,
                        text: "hello from telegram",
                        chat: { id: 42 },
                      },
                    },
                  ]
                : [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (method === "sendMessage") {
        sentMessages.push(String(body.text ?? ""));
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: false, description: "unknown method" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const runtime = startOptiDevTelegramBridgeRuntime({
      context,
      getSnapshot: async () => makeSnapshot(),
      dispatchCommand: async (command) => {
        dispatched.push(command);
      },
      fetchImpl,
      pollIntervalMs: 10,
    });

    try {
      await vi.waitFor(() => {
        expect(dispatched.length).toBe(1);
      });

      const command = dispatched[0] as Extract<
        Awaited<ReturnType<typeof Promise.resolve>>,
        { type: "thread.turn.start" }
      > & {
        type: "thread.turn.start";
        message: { messageId: string; text: string };
        threadId: string;
      };
      expect(command.type).toBe("thread.turn.start");
      expect(command.threadId).toBe("thread-beta");
      expect(command.message.text).toBe("hello from telegram");

      runtime.handleDomainEvent({
        sequence: 1,
        eventId: "event-1",
        aggregateKind: "thread",
        aggregateId: "thread-beta",
        occurredAt: "2026-03-13T00:00:03.000Z",
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type: "thread.message-sent",
        payload: {
          threadId: ThreadId.makeUnsafe("thread-beta"),
          messageId: MessageId.makeUnsafe(command.message.messageId),
          role: "user",
          text: "hello from telegram",
          attachments: [],
          turnId: null,
          streaming: false,
          createdAt: "2026-03-13T00:00:03.000Z",
          updatedAt: "2026-03-13T00:00:03.000Z",
        },
      } satisfies OrchestrationEvent);

      runtime.handleDomainEvent({
        sequence: 2,
        eventId: "event-2",
        aggregateKind: "thread",
        aggregateId: "thread-beta",
        occurredAt: "2026-03-13T00:00:04.000Z",
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type: "thread.message-sent",
        payload: {
          threadId: ThreadId.makeUnsafe("thread-beta"),
          messageId: MessageId.makeUnsafe("assistant-1"),
          role: "assistant",
          text: "reply from assistant",
          attachments: [],
          turnId: null,
          streaming: false,
          createdAt: "2026-03-13T00:00:04.000Z",
          updatedAt: "2026-03-13T00:00:04.000Z",
        },
      } satisfies OrchestrationEvent);

      await vi.waitFor(() => {
        expect(sentMessages).toContain("reply from assistant");
      });
      expect(sentMessages).not.toContain("You: hello from telegram");
    } finally {
      runtime.stop();
    }
  });

  it("responds to /status with the attached thread information", async () => {
    const homeDir = makeTempDir("optidev-telegram-home-");
    const context = makeContext(homeDir, "/repo/demo");
    seedActiveSession(homeDir, "demo");
    seedTelegramConfig(homeDir);
    seedTelegramState(homeDir, 100);

    const sentMessages: string[] = [];
    let getUpdatesCalls = 0;

    const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const method = url.split("/").at(-1);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (method === "getUpdates") {
        getUpdatesCalls += 1;
        return new Response(
          JSON.stringify({
            ok: true,
            result:
              getUpdatesCalls === 1
                ? [
                    {
                      update_id: 101,
                      message: {
                        message_id: 1,
                        text: "/status",
                        chat: { id: 42 },
                      },
                    },
                  ]
                : [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (method === "sendMessage") {
        sentMessages.push(String(body.text ?? ""));
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: false, description: "unknown method" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const runtime = startOptiDevTelegramBridgeRuntime({
      context,
      getSnapshot: async () => makeSnapshot(),
      dispatchCommand: async () => undefined,
      fetchImpl,
      pollIntervalMs: 10,
    });

    try {
      await vi.waitFor(() => {
        expect(sentMessages.some((message) => message.includes("thread \"Newest active thread\""))).toBe(true);
      });
    } finally {
      runtime.stop();
    }
  });

  it("processes the first fresh update after bridge enable without persisted offset", async () => {
    const homeDir = makeTempDir("optidev-telegram-home-");
    const context = makeContext(homeDir, "/repo/demo");
    seedActiveSession(homeDir, "demo");
    seedTelegramConfig(homeDir, {
      updated_at: "2026-03-13T00:00:00.000Z",
    });

    const dispatched: unknown[] = [];
    let getUpdatesCalls = 0;

    const fetchImpl: typeof fetch = vi.fn(async (input) => {
      const url = String(input);
      const method = url.split("/").at(-1);
      if (method === "getUpdates") {
        getUpdatesCalls += 1;
        return new Response(
          JSON.stringify({
            ok: true,
            result:
              getUpdatesCalls === 1
                ? [
                    {
                      update_id: 101,
                      message: {
                        message_id: 1,
                        date: 1_773_360_001,
                        text: "fresh after enable",
                        chat: { id: 42 },
                      },
                    },
                  ]
                : [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (method === "sendMessage") {
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: false, description: "unknown method" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const runtime = startOptiDevTelegramBridgeRuntime({
      context,
      getSnapshot: async () => makeSnapshot(),
      dispatchCommand: async (command) => {
        dispatched.push(command);
      },
      fetchImpl,
      pollIntervalMs: 10,
    });

    try {
      await vi.waitFor(() => {
        expect(dispatched.length).toBe(1);
      });

      const command = dispatched[0] as {
        type: "thread.turn.start";
        message: { text: string };
      };
      expect(command.type).toBe("thread.turn.start");
      expect(command.message.text).toBe("fresh after enable");
    } finally {
      runtime.stop();
    }
  });

  it("uses stable command and message ids when the same telegram update is replayed after restart", async () => {
    const homeDir = makeTempDir("optidev-telegram-home-");
    const context = makeContext(homeDir, "/repo/demo");
    seedActiveSession(homeDir, "demo");
    seedTelegramConfig(homeDir);

    const dispatchedFirst: Array<{ commandId: string; messageId: string; text: string }> = [];
    const dispatchedSecond: Array<{ commandId: string; messageId: string; text: string }> = [];

    const makeFetch = (): typeof fetch => {
      let delivered = false;
      return vi.fn(async (input) => {
        const url = String(input);
        const method = url.split("/").at(-1);
        if (method === "getUpdates") {
          const result = delivered
            ? []
            : [
                {
                  update_id: 101,
                  message: {
                    message_id: 1,
                    text: "same telegram update",
                    chat: { id: 42 },
                  },
                },
              ];
          delivered = true;
          return new Response(
            JSON.stringify({
              ok: true,
              result,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (method === "sendMessage") {
          return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: false, description: "unknown method" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;
    };

    const runtimeOne = startOptiDevTelegramBridgeRuntime({
      context,
      getSnapshot: async () => makeSnapshot(),
      dispatchCommand: async (command) => {
        if (command.type === "thread.turn.start") {
          dispatchedFirst.push({
            commandId: command.commandId,
            messageId: command.message.messageId,
            text: command.message.text,
          });
        }
      },
      fetchImpl: makeFetch(),
      pollIntervalMs: 10,
    });

    try {
      await vi.waitFor(() => {
        expect(dispatchedFirst.length).toBe(1);
      });
    } finally {
      runtimeOne.stop();
    }

    fs.rmSync(path.join(homeDir, "plugins", "telegram-bridge-state.json"), { force: true });

    const runtimeTwo = startOptiDevTelegramBridgeRuntime({
      context,
      getSnapshot: async () => makeSnapshot(),
      dispatchCommand: async (command) => {
        if (command.type === "thread.turn.start") {
          dispatchedSecond.push({
            commandId: command.commandId,
            messageId: command.message.messageId,
            text: command.message.text,
          });
        }
      },
      fetchImpl: makeFetch(),
      pollIntervalMs: 10,
    });

    try {
      await vi.waitFor(() => {
        expect(dispatchedSecond.length).toBe(1);
      });
      expect(dispatchedFirst[0]).toEqual(dispatchedSecond[0]);
    } finally {
      runtimeTwo.stop();
    }
  });

  it("recovers after a timed out telegram poll and continues processing later updates", async () => {
    const homeDir = makeTempDir("optidev-telegram-home-");
    const context = makeContext(homeDir, "/repo/demo");
    seedActiveSession(homeDir, "demo");
    seedTelegramConfig(homeDir);
    seedTelegramState(homeDir, 100);

    const dispatched: string[] = [];
    let getUpdatesCalls = 0;

    const fetchImpl: typeof fetch = vi.fn((input, init) => {
      const url = String(input);
      const method = url.split("/").at(-1);
      if (method === "getUpdates") {
        getUpdatesCalls += 1;
        if (getUpdatesCalls === 1) {
          return new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          });
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              result:
                getUpdatesCalls === 2
                  ? [
                      {
                        update_id: 101,
                        message: {
                          message_id: 1,
                          text: "after timeout",
                          chat: { id: 42 },
                        },
                      },
                    ]
                  : [],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (method === "sendMessage") {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: false, description: "unknown method" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as typeof fetch;

    const runtime = startOptiDevTelegramBridgeRuntime({
      context,
      getSnapshot: async () => makeSnapshot(),
      dispatchCommand: async (command) => {
        if (command.type === "thread.turn.start") {
          dispatched.push(command.message.text);
        }
      },
      fetchImpl,
      pollIntervalMs: 10,
      requestTimeoutMs: 20,
    });

    try {
      await vi.waitFor(() => {
        expect(dispatched).toEqual(["after timeout"]);
      });
      expect(getUpdatesCalls).toBeGreaterThanOrEqual(2);
    } finally {
      runtime.stop();
    }
  });

  it("does not let a stopped runtime process late poll results after a replacement runtime starts", async () => {
    const homeDir = makeTempDir("optidev-telegram-home-");
    const context = makeContext(homeDir, "/repo/demo");
    seedActiveSession(homeDir, "demo");
    seedTelegramConfig(homeDir);
    seedTelegramState(homeDir, 100);

    const staleDispatches: string[] = [];
    const freshDispatches: string[] = [];
    let resolveStalePoll: ((value: Response) => void) | null = null;
    let freshDelivered = false;

    const staleFetch: typeof fetch = vi.fn((input) => {
      const url = String(input);
      const method = url.split("/").at(-1);
      if (method === "getUpdates") {
        return new Promise<Response>((resolve) => {
          resolveStalePoll = resolve;
        });
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as typeof fetch;

    const freshFetch: typeof fetch = vi.fn(async (input) => {
      const url = String(input);
      const method = url.split("/").at(-1);
      if (method === "getUpdates") {
        if (freshDelivered) {
          return new Response(JSON.stringify({ ok: true, result: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        freshDelivered = true;
        return new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                update_id: 101,
                message: {
                  message_id: 1,
                  text: "fresh runtime only",
                  chat: { id: 42 },
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const staleRuntime = startOptiDevTelegramBridgeRuntime({
      context,
      getSnapshot: async () => makeSnapshot(),
      dispatchCommand: async (command) => {
        if (command.type === "thread.turn.start") {
          staleDispatches.push(command.message.text);
        }
      },
      fetchImpl: staleFetch,
      pollIntervalMs: 10,
    });

    const freshRuntime = startOptiDevTelegramBridgeRuntime({
      context,
      getSnapshot: async () => makeSnapshot(),
      dispatchCommand: async (command) => {
        if (command.type === "thread.turn.start") {
          freshDispatches.push(command.message.text);
        }
      },
      fetchImpl: freshFetch,
      pollIntervalMs: 10,
    });

    try {
      await vi.waitFor(() => {
        expect(freshDispatches).toEqual(["fresh runtime only"]);
      });

      resolveStalePoll?.(
        new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                update_id: 101,
                message: {
                  message_id: 1,
                  text: "stale runtime duplicate",
                  chat: { id: 42 },
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(staleDispatches).toEqual([]);
      expect(freshDispatches).toEqual(["fresh runtime only"]);
    } finally {
      staleRuntime.stop();
      freshRuntime.stop();
    }
  });
});
