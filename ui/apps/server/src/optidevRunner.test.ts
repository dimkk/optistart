import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  MessageId,
  ThreadId,
  TurnId,
  type OrchestrationReadModel,
  type ProviderSession,
} from "@t3tools/contracts";
import { Effect, Option, Stream } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildRunnerInventory,
  enrichRunnerInventoryManifestStatus,
  nativeRunnerListAction,
  nativeRunnerResumeAction,
  readCodexSessionInventory,
  runServerRunnerAction,
} from "./optidevRunner";
import type { OrchestrationEngineShape } from "./orchestration/Services/OrchestrationEngine";
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
  const tempDirs: string[] = [];

  function makeTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  function writeWorkspaceManifest(projectPath: string) {
    fs.mkdirSync(path.join(projectPath, ".optidev"), { recursive: true });
    fs.writeFileSync(
      path.join(projectPath, ".optidev", "workspace.yaml"),
      [
        "project: demo",
        "workspace:",
        "  active_task: ship-it",
        "  branch: main",
        "  head_commit: abc123",
        "  mux: zellij",
        "agents: []",
        "layout: []",
        "services: []",
        "tests:",
        '  command: ""',
        "logs:",
        '  command: ""',
        "context:",
        "  agents_dir: .agents/agents",
        "  skills_dir: .agents/skills",
        "  mcp_dir: .agents/mcp",
      ].join("\n"),
      "utf8",
    );
  }

  function writeCodexStateDb(
    codexHome: string,
    rows: Array<{
      id: string;
      cwd: string;
      title: string;
      firstUserMessage?: string;
      updatedAt: number;
      archived?: number;
      source?: string;
    }>,
    version = 5,
  ) {
    fs.mkdirSync(codexHome, { recursive: true });
    const dbPath = path.join(codexHome, `state_${version}.sqlite`);
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        rollout_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source TEXT NOT NULL,
        model_provider TEXT NOT NULL,
        cwd TEXT NOT NULL,
        title TEXT NOT NULL,
        sandbox_policy TEXT NOT NULL,
        approval_mode TEXT NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        has_user_event INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at INTEGER,
        git_sha TEXT,
        git_branch TEXT,
        git_origin_url TEXT,
        cli_version TEXT NOT NULL DEFAULT '',
        first_user_message TEXT NOT NULL DEFAULT '',
        agent_nickname TEXT,
        agent_role TEXT,
        memory_mode TEXT NOT NULL DEFAULT 'enabled'
      );
    `);
    const insert = db.prepare(`
      INSERT INTO threads (
        id,
        rollout_path,
        created_at,
        updated_at,
        source,
        model_provider,
        cwd,
        title,
        sandbox_policy,
        approval_mode,
        archived,
        first_user_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of rows) {
      insert.run(
        row.id,
        `/tmp/${row.id}`,
        row.updatedAt - 120,
        row.updatedAt,
        row.source ?? "cli",
        "openai",
        row.cwd,
        row.title,
        "danger-full-access",
        "never",
        row.archived ?? 0,
        row.firstUserMessage ?? "",
      );
    }
    db.close();
  }

  function makeUnusedProviderService(): ProviderServiceShape {
    return {
      startSession: vi.fn(() => Effect.die(new Error("unsupported"))),
      sendTurn: vi.fn(() => Effect.die(new Error("unsupported"))),
      interruptTurn: vi.fn(() => Effect.die(new Error("unsupported"))),
      respondToRequest: vi.fn(() => Effect.die(new Error("unsupported"))),
      respondToUserInput: vi.fn(() => Effect.die(new Error("unsupported"))),
      stopSession: vi.fn(() => Effect.die(new Error("unsupported"))),
      listSessions: vi.fn(() => Effect.succeed([])),
      getCapabilities: vi.fn(() => Effect.die(new Error("unsupported"))),
      readThread: vi.fn(() => Effect.die(new Error("unsupported"))),
      rollbackConversation: vi.fn(() => Effect.die(new Error("unsupported"))),
      streamEvents: Stream.empty,
    };
  }

  function makeUnusedProviderSessionDirectory(): ProviderSessionDirectoryShape {
    return {
      upsert: vi.fn(() => Effect.void),
      getProvider: vi.fn(() => Effect.die(new Error("unsupported"))),
      getBinding: vi.fn(() => Effect.succeed(Option.none())),
      remove: vi.fn(() => Effect.void),
      listThreadIds: vi.fn(() => Effect.succeed([])),
    };
  }

  function makeProjectionSnapshotQuery(): ProjectionSnapshotQueryShape {
    return {
      getSnapshot: vi.fn(() => Effect.succeed(makeSnapshot())),
    };
  }

  function makeEmptyProjectionSnapshotQuery(): ProjectionSnapshotQueryShape {
    return {
      getSnapshot: vi.fn(() =>
        Effect.succeed({
          projects: [],
          threads: [],
          turns: [],
          checkpoints: [],
          pendingApprovals: [],
        } satisfies OrchestrationReadModel),
      ),
    };
  }

  function makeOrchestrationEngine(): OrchestrationEngineShape {
    return {
      getReadModel: vi.fn(() =>
        Effect.succeed({
          projects: [],
          threads: [],
          turns: [],
          checkpoints: [],
          pendingApprovals: [],
        } satisfies OrchestrationReadModel),
      ),
      readEvents: Stream.empty,
      dispatch: vi.fn(() => Effect.succeed({ sequence: 1 })),
      streamDomainEvents: Stream.empty,
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
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
      readThread: vi.fn(() => Effect.die(new Error("unsupported"))),
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

  it("marks live Codex sessions by OptiDev manifest presence only", async () => {
    const managedProject = makeTempDir("optidev-runner-managed-");
    writeWorkspaceManifest(managedProject);
    const unmanagedProject = makeTempDir("optidev-runner-unmanaged-");

    const entries = buildRunnerInventory({
      snapshot: makeSnapshot(),
      sessions: [
        makeSession({
          threadId: ThreadId.makeUnsafe("thread-alpha"),
          cwd: managedProject,
          updatedAt: "2026-03-12T09:10:00.000Z",
        }),
        makeSession({
          threadId: ThreadId.makeUnsafe("thread-beta"),
          cwd: unmanagedProject,
          updatedAt: "2026-03-12T08:10:00.000Z",
        }),
      ],
    });

    const enriched = await enrichRunnerInventoryManifestStatus(entries);

    expect(enriched[0]?.guid).toBe("thread-alpha");
    expect(enriched[0]?.manifestStatus).toBe("present");
    expect(enriched[0]?.manifestNote).toBeNull();
    expect(enriched[1]?.guid).toBe("thread-beta");
    expect(enriched[1]?.manifestStatus).toBe("missing");
    expect(enriched[1]?.manifestNote).toContain("No OptiDev workspace manifest found");
  });

  it("reads machine-local Codex sessions from the latest local state db", async () => {
    const codexHome = makeTempDir("optidev-codex-home-");
    writeCodexStateDb(
      codexHome,
      [
        {
          id: "thread-old",
          cwd: "/repo/old",
          title: "Old thread",
          firstUserMessage: "Old message",
          updatedAt: 1_773_357_000,
        },
      ],
      4,
    );
    writeCodexStateDb(codexHome, [
      {
        id: "thread-alpha",
        cwd: "/repo/demo",
        title: "Alpha thread",
        firstUserMessage: "Fix landing hero spacing and keep the CTA visible on mobile.",
        updatedAt: 1_773_357_858,
      },
      {
        id: "thread-beta",
        cwd: "/repo/external",
        title: "Beta thread",
        firstUserMessage: "Audit all pending CI failures.",
        updatedAt: 1_773_357_100,
      },
      {
        id: "thread-alpha-child",
        cwd: "/repo/demo",
        title: "Child thread",
        firstUserMessage: "Newest child prompt should win.",
        updatedAt: 1_773_357_900,
        source: JSON.stringify({
          subagent: {
            thread_spawn: {
              parent_thread_id: "thread-alpha",
            },
          },
        }),
      },
      {
        id: "thread-archived",
        cwd: "/repo/archived",
        title: "Archived thread",
        firstUserMessage: "Should not render",
        updatedAt: 1_773_357_900,
        archived: 1,
      },
    ]);

    const entries = await readCodexSessionInventory({ ...process.env, CODEX_HOME: codexHome });

    expect(entries.map((entry) => entry.guid)).toEqual(["thread-alpha", "thread-beta"]);
    expect(entries[0]).toMatchObject({
      alias: 1,
      runner: "codex",
      cwd: "/repo/demo",
      latestUserPhrase: "Newest child prompt should win.",
      runtimeStatus: "available",
      sessionStatus: null,
    });
    expect(entries[0]?.lastSeenAt).toBe("2026-03-12T23:25:00.000Z");
  });

  it("serves machine-local Codex sessions with manifest markers", async () => {
    const codexHome = makeTempDir("optidev-codex-home-");
    const managedProject = makeTempDir("optidev-runner-managed-");
    const unmanagedProject = makeTempDir("optidev-runner-unmanaged-");
    writeWorkspaceManifest(managedProject);
    writeCodexStateDb(codexHome, [
      {
        id: "thread-alpha",
        cwd: managedProject,
        title: "Managed thread",
        firstUserMessage: "Inside the workspace",
        updatedAt: 1_773_357_858,
      },
      {
        id: "thread-beta",
        cwd: unmanagedProject,
        title: "External thread",
        firstUserMessage: "Outside the workspace",
        updatedAt: 1_773_357_100,
      },
    ]);

    const result = await runServerRunnerAction({
      action: "codex_sessions",
      payload: {},
      providerService: makeUnusedProviderService(),
      providerSessionDirectory: makeUnusedProviderSessionDirectory(),
      projectionSnapshotQuery: makeProjectionSnapshotQuery(),
      env: { ...process.env, CODEX_HOME: codexHome },
    });

    expect(result).not.toBeNull();
    expect(result?.ok).toBe(true);
    expect(result?.data).toEqual([
      expect.objectContaining({
        guid: "thread-alpha",
        manifestStatus: "present",
      }),
      expect.objectContaining({
        guid: "thread-beta",
        manifestStatus: "missing",
      }),
    ]);
    expect(result?.lines[0]).toContain("manifest=present");
    expect(result?.lines[1]).toContain("manifest=missing");
  });

  it("connects a machine-local Codex session into orchestration chat state", async () => {
    const codexHome = makeTempDir("optidev-codex-home-");
    writeCodexStateDb(codexHome, [
      {
        id: "thread-alpha",
        cwd: "/repo/demo",
        title: "Alpha thread",
        firstUserMessage: "Resume this Codex session.",
        updatedAt: 1_773_357_858,
      },
    ]);

    const providerService: ProviderServiceShape = {
      startSession: vi.fn((threadId) =>
        Effect.succeed({
          provider: "codex",
          status: "ready",
          runtimeMode: "full-access",
          threadId,
          cwd: "/repo/demo",
          createdAt: "2026-03-12T23:00:00.000Z",
          updatedAt: "2026-03-12T23:00:00.000Z",
          resumeCursor: { threadId: "thread-alpha" },
        }),
      ),
      sendTurn: vi.fn(() => Effect.die(new Error("unsupported"))),
      interruptTurn: vi.fn(() => Effect.die(new Error("unsupported"))),
      respondToRequest: vi.fn(() => Effect.die(new Error("unsupported"))),
      respondToUserInput: vi.fn(() => Effect.die(new Error("unsupported"))),
      stopSession: vi.fn(() => Effect.die(new Error("unsupported"))),
      listSessions: vi.fn(() => Effect.succeed([])),
      getCapabilities: vi.fn(() => Effect.die(new Error("unsupported"))),
      readThread: vi.fn(() =>
        Effect.succeed({
          threadId: ThreadId.makeUnsafe("thread-alpha"),
          turns: [
            {
              id: TurnId.makeUnsafe("turn-1"),
              items: [
                {
                  type: "userMessage",
                  id: "item-user-1",
                  content: [{ type: "text", text: "quit" }],
                },
                {
                  type: "agentMessage",
                  id: "item-agent-1",
                  text: "Stopping here.",
                },
              ],
            },
          ],
        }),
      ),
      rollbackConversation: vi.fn(() => Effect.die(new Error("unsupported"))),
      streamEvents: Stream.empty,
    };
    const orchestrationEngine = makeOrchestrationEngine();

    const result = await runServerRunnerAction({
      action: "codex_connect",
      payload: { threadId: "thread-alpha" },
      providerService,
      providerSessionDirectory: makeUnusedProviderSessionDirectory(),
      projectionSnapshotQuery: makeEmptyProjectionSnapshotQuery(),
      orchestrationEngine,
      env: { ...process.env, CODEX_HOME: codexHome },
    });

    expect(result).not.toBeNull();
    expect(result?.ok).toBe(true);
    expect(result?.data).toMatchObject({
      threadId: "thread-alpha",
      guid: "thread-alpha",
      cwd: "/repo/demo",
    });
    expect(providerService.startSession).toHaveBeenCalledWith(
      "thread-alpha",
      expect.objectContaining({
        provider: "codex",
        cwd: "/repo/demo",
        resumeCursor: { threadId: "thread-alpha" },
      }),
    );
    expect(orchestrationEngine.dispatch).toHaveBeenCalledTimes(5);
    expect(orchestrationEngine.dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "project.create", workspaceRoot: "/repo/demo" }),
    );
    expect(orchestrationEngine.dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "thread.create", threadId: "thread-alpha", worktreePath: "/repo/demo" }),
    );
    expect(orchestrationEngine.dispatch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ type: "thread.session.set", threadId: "thread-alpha" }),
    );
    expect(orchestrationEngine.dispatch).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        type: "thread.message.import",
        threadId: "thread-alpha",
        message: expect.objectContaining({
          messageId: MessageId.makeUnsafe("user:item-user-1"),
          role: "user",
          text: "quit",
          turnId: null,
        }),
      }),
    );
    expect(orchestrationEngine.dispatch).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        type: "thread.message.import",
        threadId: "thread-alpha",
        message: expect.objectContaining({
          messageId: MessageId.makeUnsafe("assistant:item-agent-1"),
          role: "assistant",
          text: "Stopping here.",
          turnId: TurnId.makeUnsafe("turn-1"),
        }),
      }),
    );
    expect(result?.lines).toContain("Imported transcript messages: 2.");
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
      readThread: vi.fn(() => Effect.die(new Error("unsupported"))),
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
