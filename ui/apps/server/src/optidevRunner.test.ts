import {
  ThreadId,
  type OrchestrationReadModel,
  type ProviderSession,
} from "@t3tools/contracts";
import { Effect, Option, Stream } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  nativeRunnerListAction,
  nativeRunnerResumeAction,
  runServerRunnerAction,
} from "./optidevRunner";
import type { ProjectionSnapshotQueryShape } from "./orchestration/Services/ProjectionSnapshotQuery";
import type { ProviderSessionDirectoryShape } from "./provider/Services/ProviderSessionDirectory";
import type { ProviderServiceShape } from "./provider/Services/ProviderService";

function makeSession(overrides: Partial<ProviderSession> = {}): ProviderSession {
  return {
    provider: "codex",
    status: "ready",
    runtimeMode: "full-access",
    cwd: "/repo/demo",
    threadId: ThreadId.makeUnsafe("thread-alpha"),
    createdAt: "2026-03-12T09:00:00.000Z",
    updatedAt: "2026-03-12T09:00:00.000Z",
    resumeCursor: { threadId: "provider-thread-alpha" },
    ...overrides,
  };
}

function makeSnapshot(): OrchestrationReadModel {
  return {
    projects: [],
    threads: [
      {
        id: "thread-alpha",
        projectId: "project-demo",
        title: "Alpha",
        model: "gpt-5.3-codex",
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: "/repo/demo",
        latestTurnId: null,
        createdAt: "2026-03-12T09:00:00.000Z",
        updatedAt: "2026-03-12T09:10:00.000Z",
        deletedAt: null,
        session: {
          threadId: "thread-alpha",
          status: "running",
          providerName: "codex",
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: "2026-03-12T09:10:00.000Z",
        },
        messages: [
          {
            id: "message-alpha",
            turnId: null,
            role: "user",
            text: "Fix landing hero spacing and keep the CTA visible on mobile.",
            isStreaming: false,
            createdAt: "2026-03-12T09:05:00.000Z",
            updatedAt: "2026-03-12T09:05:00.000Z",
            attachments: [],
          },
        ],
        proposedPlan: null,
        activities: [],
      },
      {
        id: "thread-beta",
        projectId: "project-demo",
        title: "Beta",
        model: "gpt-5.3-codex",
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: "/repo/other",
        latestTurnId: null,
        createdAt: "2026-03-12T08:00:00.000Z",
        updatedAt: "2026-03-12T08:10:00.000Z",
        deletedAt: null,
        session: {
          threadId: "thread-beta",
          status: "ready",
          providerName: "codex",
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: "2026-03-12T08:10:00.000Z",
        },
        messages: [],
        proposedPlan: null,
        activities: [],
      },
    ],
    turns: [],
    checkpoints: [],
    pendingApprovals: [],
  } satisfies OrchestrationReadModel;
}

describe("optidevRunner", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("forwards runner inventory reads to the live OptiDev server", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          lines: ["1. runner=codex | guid=thread-alpha | cwd=/repo/demo | user=\"Fix landing hero spacing and keep the CTA visible on mobile.\" | runtime=running | session=running"],
          data: [
            {
              alias: 1,
              runner: "codex",
              guid: "thread-alpha",
              cwd: "/repo/demo",
              latestUserPhrase: "Fix landing hero spacing and keep the CTA visible on mobile.",
              runtimeStatus: "running",
              sessionStatus: "running",
              lastSeenAt: "2026-03-12T09:10:00.000Z",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await nativeRunnerListAction(
      { cwd: "/repo/demo" },
      { ...process.env, OPTID_SERVER_URL: "http://127.0.0.1:4010" },
    );

    expect(result.ok).toBe(true);
    expect(result.lines[0]).toContain("1. runner=codex | guid=thread-alpha");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4010/api/optidev/action",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "runner_list" }),
      }),
    );
  });

  it("lists open runner sessions ordered by latest activity on the live server", async () => {
    const providerService: ProviderServiceShape = {
      startSession: vi.fn(() => Effect.succeed(makeSession())),
      sendTurn: vi.fn(() => Effect.die(new Error("unsupported"))),
      interruptTurn: vi.fn(() => Effect.die(new Error("unsupported"))),
      respondToRequest: vi.fn(() => Effect.die(new Error("unsupported"))),
      respondToUserInput: vi.fn(() => Effect.die(new Error("unsupported"))),
      stopSession: vi.fn(() => Effect.die(new Error("unsupported"))),
      listSessions: vi.fn(() =>
        Effect.succeed([
          makeSession({
            threadId: ThreadId.makeUnsafe("thread-beta"),
            cwd: "/repo/other",
            updatedAt: "2026-03-12T08:10:00.000Z",
          }),
          makeSession({
            threadId: ThreadId.makeUnsafe("thread-alpha"),
            status: "running",
            cwd: "/repo/demo",
            updatedAt: "2026-03-12T09:10:00.000Z",
          }),
        ]),
      ),
      getCapabilities: vi.fn(() => Effect.die(new Error("unsupported"))),
      rollbackConversation: vi.fn(() => Effect.die(new Error("unsupported"))),
      streamEvents: Stream.empty,
    };
    const providerSessionDirectory: ProviderSessionDirectoryShape = {
      upsert: vi.fn(() => Effect.void),
      getProvider: vi.fn(() => Effect.die(new Error("unsupported"))),
      getBinding: vi.fn(() => Effect.succeed(Option.none())),
      remove: vi.fn(() => Effect.void),
      listThreadIds: vi.fn(() => Effect.succeed([])),
    };
    const projectionSnapshotQuery: ProjectionSnapshotQueryShape = {
      getSnapshot: vi.fn(() => Effect.succeed(makeSnapshot())),
    };

    const result = await runServerRunnerAction({
      action: "runner_list",
      payload: {},
      providerService,
      providerSessionDirectory,
      projectionSnapshotQuery,
    });

    expect(result).not.toBeNull();
    expect(result?.ok).toBe(true);
    expect(result?.lines[0]).toContain("1. runner=codex | guid=thread-alpha");
    expect(result?.lines[0]).toContain('user="Fix landing hero spacing and keep the CTA visible on mobile."');
    expect(result?.lines[1]).toContain("2. runner=codex | guid=thread-beta");
  });

  it("resolves an alias from the live runner inventory and posts runner resume", async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string; threadId?: string };
      if (body.action === "runner_list") {
        return new Response(
          JSON.stringify({
            ok: true,
            lines: ["1. runner=codex | guid=thread-alpha | cwd=/repo/demo | user=\"Fix landing hero spacing and keep the CTA visible on mobile.\" | runtime=running | session=running"],
            data: [
              {
                alias: 1,
                runner: "codex",
                guid: "thread-alpha",
                cwd: "/repo/demo",
                latestUserPhrase: "Fix landing hero spacing and keep the CTA visible on mobile.",
                runtimeStatus: "running",
                sessionStatus: "running",
                lastSeenAt: "2026-03-12T09:10:00.000Z",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          lines: ["Runner session resumed: codex thread-alpha.", "Cwd: /repo/demo."],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await nativeRunnerResumeAction(
      { cwd: "/repo/demo" },
      "1",
      {
        ...process.env,
        OPTID_SERVER_URL: "http://127.0.0.1:4010",
      },
    );

    expect(result.ok).toBe(true);
    expect(result.lines[0]).toBe("Resolved runner 1 -> thread-alpha.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers a runner thread through persisted provider binding on the server side", async () => {
    const providerService: ProviderServiceShape = {
      startSession: vi.fn(() => Effect.succeed(makeSession())),
      sendTurn: vi.fn(() => Effect.die(new Error("unsupported"))),
      interruptTurn: vi.fn(() => Effect.die(new Error("unsupported"))),
      respondToRequest: vi.fn(() => Effect.die(new Error("unsupported"))),
      respondToUserInput: vi.fn(() => Effect.die(new Error("unsupported"))),
      stopSession: vi.fn(() => Effect.die(new Error("unsupported"))),
      listSessions: vi.fn(() => Effect.succeed([])),
      getCapabilities: vi.fn(() => Effect.die(new Error("unsupported"))),
      rollbackConversation: vi.fn(() => Effect.die(new Error("unsupported"))),
      streamEvents: Stream.empty,
    };
    const providerSessionDirectory: ProviderSessionDirectoryShape = {
      upsert: vi.fn(() => Effect.void),
      getProvider: vi.fn(() => Effect.die(new Error("unsupported"))),
      getBinding: vi.fn(() =>
        Effect.succeed(
          Option.some({
            threadId: ThreadId.makeUnsafe("thread-alpha"),
            provider: "codex",
            adapterKey: "codex",
            runtimeMode: "full-access",
            status: "running",
            resumeCursor: { threadId: "provider-thread-alpha" },
            runtimePayload: { cwd: "/repo/demo" },
          }),
        ),
      ),
      remove: vi.fn(() => Effect.void),
      listThreadIds: vi.fn(() => Effect.succeed([])),
    };
    const projectionSnapshotQuery: ProjectionSnapshotQueryShape = {
      getSnapshot: vi.fn(() => Effect.succeed(makeSnapshot())),
    };

    const result = await runServerRunnerAction({
      action: "runner_resume",
      payload: { threadId: "thread-alpha" },
      providerService,
      providerSessionDirectory,
      projectionSnapshotQuery,
    });

    expect(result).not.toBeNull();
    expect(result?.ok).toBe(true);
    expect(result?.lines[0]).toBe("Runner session resumed: codex thread-alpha.");
    expect(providerService.startSession).toHaveBeenCalledTimes(1);
  });
});
