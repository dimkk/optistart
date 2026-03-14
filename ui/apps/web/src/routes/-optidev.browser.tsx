import "../index.css";

import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";
import { page } from "vitest/browser";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { getRouter } from "../router";

interface OptiDevStateFixture {
  repoRoot: string;
  status: string;
  logs: string;
  projects: Array<{ name: string; path: string }>;
  memorySummary: string[];
  session: {
    project: string | null;
    projectPath: string | null;
    status: string;
    muxBackend: string | null;
    sessionName: string | null;
    runner: string | null;
    hooksRunning: number;
    hooksTotal: number;
    mode: string | null;
    branch: string | null;
    headCommit: string | null;
    activeTask: string | null;
    agentsCount: number;
    manifestValid: boolean;
  };
}

const actionCalls: Array<Record<string, unknown>> = [];
let fixture: OptiDevStateFixture;
let manifestPayload: {
  path: string;
  content: string;
  manifest: {
    project: string;
    workspace: {
      active_task: string;
      branch: string;
      head_commit: string;
      mux: string;
    };
    agents: Array<{ name: string; runner: string }>;
    layout: Array<{ name: string; pane: string }>;
    services: Array<{ name: string; command: string }>;
    tests: { command: string };
    logs: { command: string };
    context: {
      agents_dir: string;
      skills_dir: string;
      mcp_dir: string;
    };
  };
  impacts: Array<{ field: string; before: string; after: string; effect: string }>;
  runtimeNotes: string[];
};
let memoryGraphPayload: {
  project: string;
  focusNodeId: string | null;
  nodes: Array<{ id: string; kind: string; label: string; status: string | null; group: string; highlight: boolean }>;
  edges: Array<{ source: string; target: string; kind: string }>;
  stats: { features: number; tasks: number; releases: number; decisions: number; openLoops: number };
  implementationNotes: string[];
};
let pluginsPayload: Array<{
  id: string;
  title: string;
  category: "analysis" | "integration" | "catalog";
  enabled: boolean;
  summary: string;
  details: string[];
}>;
let runnerSessions = [
  {
    alias: 1,
    runner: "codex",
    guid: "thread-alpha",
    cwd: "/repo/demo",
    latestUserPhrase: "Fix landing hero spacing and keep the CTA visible on mobile.",
    runtimeStatus: "running",
    sessionStatus: "running",
    lastSeenAt: "2026-03-12T09:10:00.000Z",
    manifestStatus: "present",
    manifestNote: null,
  },
  {
    alias: 3,
    runner: "codex",
    guid: "thread-gamma",
    cwd: "/repo/demo",
    latestUserPhrase: "Refactor the session bootstrap so it can resume safely.",
    runtimeStatus: "ready",
    sessionStatus: "ready",
    lastSeenAt: "2026-03-12T08:40:00.000Z",
    manifestStatus: "present",
    manifestNote: null,
  },
  {
    alias: 2,
    runner: "codex",
    guid: "thread-beta",
    cwd: "/repo/external",
    latestUserPhrase: "Audit all pending CI failures.",
    runtimeStatus: "ready",
    sessionStatus: "ready",
    lastSeenAt: "2026-03-12T08:10:00.000Z",
    manifestStatus: "missing",
    manifestNote: "No OptiDev workspace manifest found for this session.",
  },
];

function seedManifestPayload() {
  manifestPayload = {
    path: "/repo/demo/.optidev/workspace.yaml",
    content:
      "project: demo\nworkspace:\n  active_task: runtime-ts-002\n  branch: main\n  head_commit: 1234567890abcdef\n  mux: zellij\nagents:\n  - name: coder\n    runner: codex\nlayout:\n  - name: Chat\n    pane: chat\n  - name: Editor\n    pane: editor\nservices:\n  - name: web\n    command: bun run dev\ntests:\n  command: bun test --watch\nlogs:\n  command: tail -f logs/dev.log\ncontext:\n  agents_dir: .agents/agents\n  skills_dir: .agents/skills\n  mcp_dir: .agents/mcp\n",
    manifest: {
      project: "demo",
      workspace: {
        active_task: "runtime-ts-002",
        branch: "main",
        head_commit: "1234567890abcdef",
        mux: "zellij",
      },
      agents: [{ name: "coder", runner: "codex" }],
      layout: [
        { name: "Chat", pane: "chat" },
        { name: "Editor", pane: "editor" },
      ],
      services: [{ name: "web", command: "bun run dev" }],
      tests: { command: "bun test --watch" },
      logs: { command: "tail -f logs/dev.log" },
      context: {
        agents_dir: ".agents/agents",
        skills_dir: ".agents/skills",
        mcp_dir: ".agents/mcp",
      },
    },
    impacts: [
      {
        field: "workspace.active_task",
        before: "runtime-ts-002",
        after: "runtime-ts-002",
        effect: "Changes bootstrap focus and memory context after the next lifecycle action.",
      },
    ],
    runtimeNotes: [
      "Runtime controls are secondary. They apply the saved manifest to start, resume, reset, stop, or clone workspace state.",
    ],
  };
}

function seedMemoryGraphPayload() {
  memoryGraphPayload = {
    project: "demo",
    focusNodeId: "feature:runtime-ts-002",
    nodes: [
      {
        id: "project:demo",
        kind: "project",
        label: "demo",
        status: null,
        group: "project",
        highlight: true,
      },
      {
        id: "feature:runtime-ts-002",
        kind: "feature",
        label: "runtime-ts-002",
        status: "DONE",
        group: "runtime",
        highlight: true,
      },
    ],
    edges: [{ source: "project:demo", target: "feature:runtime-ts-002", kind: "active-feature" }],
    stats: {
      features: 1,
      tasks: 1,
      releases: 1,
      decisions: 1,
      openLoops: 1,
    },
    implementationNotes: [
      "Keep ingestion artifact-backed: every node should be traceable to docs, reports, releases, or session state.",
    ],
  };
}

function seedPluginsPayload() {
  pluginsPayload = [
    {
      id: "advice",
      title: "Advice",
      category: "analysis",
      enabled: true,
      summary: "Repository bootstrap analysis that prepares a concise repo summary for the runner.",
      details: ["- root: /repo/demo"],
    },
    {
      id: "telegram",
      title: "Telegram",
      category: "integration",
      enabled: true,
      summary: "Telegram bridge is enabled for chat 42 (token toke***-1). Selected session: thread-alpha.",
      details: ["chat: 42", "token: toke***-1", "target session: thread-alpha"],
    },
    {
      id: "skills",
      title: "Skills",
      category: "catalog",
      enabled: true,
      summary: "Searches for installable skills and writes selected ones into .agents/skills.",
      details: ["command: optid skills search <query...>"],
    },
    {
      id: "agents",
      title: "Agents",
      category: "catalog",
      enabled: true,
      summary: "Searches and installs agent definitions into .agents/agents.",
      details: ["command: optid agents install <slug|url>"],
    },
  ];
}

const worker = setupWorker(
  http.get("/api/optidev/state", () =>
    HttpResponse.json({
      ok: true,
      lines: [],
      state: fixture,
    }),
  ),
  http.get("/api/optidev/fs/list", ({ request }) => {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const currentPath = url.searchParams.get("path") ?? "";

    if (scope !== "repo") {
      return HttpResponse.json({ ok: false, lines: ["Unsupported file scope."] }, { status: 400 });
    }

    if (currentPath === "") {
      return HttpResponse.json({
        ok: true,
        data: {
          scope,
          path: "",
          entries: [
            { name: "docs", path: "docs", kind: "directory", size: null },
            { name: "README.md", path: "README.md", kind: "file", size: 24 },
          ],
        },
      });
    }

    return HttpResponse.json({
      ok: true,
      data: {
        scope,
        path: currentPath,
        entries: [{ name: "guide.md", path: "docs/guide.md", kind: "file", size: 18 }],
      },
    });
  }),
  http.get("/api/optidev/fs/read", ({ request }) => {
    const url = new URL(request.url);
    const currentPath = url.searchParams.get("path");

    if (currentPath === "README.md") {
      return HttpResponse.json({
        ok: true,
        data: {
          scope: "repo",
          path: "README.md",
          name: "README.md",
          kind: "markdown",
          language: "markdown",
          content: "# Demo\n\nHello from OptiDev.",
          size: 28,
          editable: false,
        },
      });
    }

    return HttpResponse.json({ ok: false, lines: ["File not found."] }, { status: 404 });
  }),
  http.get("/api/optidev/manifest", () =>
    HttpResponse.json({
      ok: true,
      data: manifestPayload,
    }),
  ),
  http.post("/api/optidev/manifest/impact", async ({ request }) => {
    const payload = (await request.json()) as { content?: string };
    const content = payload.content ?? manifestPayload.content;
    return HttpResponse.json({
      ok: true,
      data: {
        ...manifestPayload,
        content,
        impacts: [
          {
            field: "workspace.branch",
            before: manifestPayload.manifest.workspace.branch,
            after: content.includes("feature/manifest-ui")
              ? "feature/manifest-ui"
              : manifestPayload.manifest.workspace.branch,
            effect: "Changes the branch OptiDev expects this workspace to align with on the next start/resume/reset flow.",
          },
        ],
      },
    });
  }),
  http.post("/api/optidev/manifest", async ({ request }) => {
    const payload = (await request.json()) as { content?: string };
    const content = payload.content ?? manifestPayload.content;
    manifestPayload = {
      ...manifestPayload,
      content,
      manifest: {
        ...manifestPayload.manifest,
        workspace: {
          ...manifestPayload.manifest.workspace,
          branch: content.includes("feature/manifest-ui")
            ? "feature/manifest-ui"
            : manifestPayload.manifest.workspace.branch,
        },
      },
      impacts: [],
    };
    return HttpResponse.json({
      ok: true,
      lines: ["Workspace manifest saved. Start, resume, or reset to apply the updated contract."],
      data: manifestPayload,
    });
  }),
  http.get("/api/optidev/memory-graph", () =>
    HttpResponse.json({
      ok: true,
      data: memoryGraphPayload,
    }),
  ),
  http.get("/api/optidev/plugins", () =>
    HttpResponse.json({
      ok: true,
      data: pluginsPayload,
    }),
  ),
  http.post("/api/optidev/action", async ({ request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action ?? "");
    if (action !== "codex_sessions") {
      actionCalls.push(payload);
    }

    if (action === "codex_sessions") {
      return HttpResponse.json({
        ok: true,
        lines: runnerSessions.map(
          (entry) =>
            `${entry.alias}. runner=${entry.runner} | guid=${entry.guid} | cwd=${entry.cwd} | user=${JSON.stringify(entry.latestUserPhrase)} | runtime=${entry.runtimeStatus} | session=${entry.sessionStatus}`,
        ),
        data: runnerSessions,
      });
    }

    if (action === "codex_connect") {
      return HttpResponse.json({
        ok: true,
        lines: [`Connected Codex session ${String(payload.identifier ?? "")}.`],
        data: {
          threadId: String(payload.identifier ?? ""),
          guid: String(payload.identifier ?? ""),
          cwd: "/repo/demo",
        },
      });
    }

    if (action === "start") {
      fixture = {
        ...fixture,
        status: "Project: demo | Status: running | Mux: zellij | Session: optid-demo | Runner: codex | Hooks: 1/1 running | Mode: resume | Branch: main | Agents: 2 | Task: runtime-ts-002",
        session: {
          ...fixture.session,
          status: "running",
        },
      };
      return HttpResponse.json({
        ok: true,
        lines: [`start:${String(payload.target ?? ".")}`],
      });
    }

    if (action === "memory_open_loops") {
      return HttpResponse.json({
        ok: true,
        lines: ["loop: runtime-ts-002"],
      });
    }

    if (action === "workspace_clone") {
      return HttpResponse.json({
        ok: true,
        lines: [`clone:${String(payload.name ?? "")}`],
      });
    }

    return HttpResponse.json({
      ok: true,
      lines: [`action:${action}`],
    });
  }),
);

async function mountRoute(pathname: string) {
  const history = createMemoryHistory({
    initialEntries: [pathname],
  });
  const router = getRouter(history);
  await router.load();
  const screen = await render(<RouterProvider router={router} />);
  return {
    history,
    router,
    screen,
  };
}

describe("OptiDev route", () => {
  beforeAll(async () => {
    await worker.start({
      quiet: true,
      onUnhandledRequest(request, print) {
        const url = new URL(request.url);
        if (url.protocol === "ws:" || url.protocol === "wss:") {
          return;
        }
        if (!url.pathname.startsWith("/api/optidev/")) {
          return;
        }
        print.error();
      },
    });
  });

  afterAll(() => worker.stop());

  beforeEach(() => {
    fixture = {
      repoRoot: "/repo/demo",
      status: "Project: demo | Status: idle | Mux: zellij | Session: optid-demo | Runner: codex | Hooks: 1/1 running | Mode: resume | Branch: main | Agents: 2 | Task: runtime-ts-002",
      logs: "Log sources:\nbun run dev [running]",
      projects: [{ name: "demo", path: "/repo/demo" }],
      memorySummary: ["Project memory:", "- active feature: runtime-ts-002"],
      session: {
        project: "demo",
        projectPath: "/repo/demo",
        status: "idle",
        muxBackend: "zellij",
        sessionName: "optid-demo",
        runner: "codex",
        hooksRunning: 1,
        hooksTotal: 1,
        mode: "resume",
        branch: "main",
        headCommit: "1234567890abcdef",
        activeTask: "runtime-ts-002",
        agentsCount: 2,
        manifestValid: true,
      },
    };
    seedManifestPayload();
    seedMemoryGraphPayload();
    seedPluginsPayload();
    runnerSessions = [
      {
        alias: 1,
        runner: "codex",
        guid: "thread-alpha",
        cwd: "/repo/demo",
        latestUserPhrase: "Fix landing hero spacing and keep the CTA visible on mobile.",
        runtimeStatus: "running",
        sessionStatus: "running",
        lastSeenAt: "2026-03-12T09:10:00.000Z",
        manifestStatus: "present",
        manifestNote: null,
      },
      {
        alias: 3,
        runner: "codex",
        guid: "thread-gamma",
        cwd: "/repo/demo",
        latestUserPhrase: "Refactor the session bootstrap so it can resume safely.",
        runtimeStatus: "ready",
        sessionStatus: "ready",
        lastSeenAt: "2026-03-12T08:40:00.000Z",
        manifestStatus: "present",
        manifestNote: null,
      },
      {
        alias: 2,
        runner: "codex",
        guid: "thread-beta",
        cwd: "/repo/external",
        latestUserPhrase: "Audit all pending CI failures.",
        runtimeStatus: "ready",
        sessionStatus: "ready",
        lastSeenAt: "2026-03-12T08:10:00.000Z",
        manifestStatus: "missing",
        manifestNote: "No OptiDev workspace manifest found for this session.",
      },
    ];
    actionCalls.length = 0;
  });

  afterEach(() => {
    worker.resetHandlers();
  });

  it("navigates from the shell into the OptiDev route", async () => {
    const mounted = await mountRoute("/");

    await expect.element(page.getByTestId("open-optidev")).toBeInTheDocument();
    await mounted.router.navigate({ to: "/optidev" });
    await expect.poll(() => mounted.history.location.pathname).toBe("/optidev");
    await expect.element(page.getByText("OptiDev Workspace")).toBeInTheDocument();

    await mounted.screen.unmount();
  });

  it("supports shared markdown rendering plus manifest-first runtime actions", async () => {
    const mounted = await mountRoute("/optidev");

    await expect.element(page.getByText("Repository Files")).toBeInTheDocument();
    await page.getByTestId("optidev-entry-repo-README.md").click();
    await expect.element(page.getByText("Hello from OptiDev.")).toBeInTheDocument();
    await page.getByText("Source").click();
    await expect.element(page.getByText("# Demo")).toBeInTheDocument();

    await page.getByTestId("optidev-tab-optidev").click();
    await expect.element(page.getByTestId("optidev-manifest-editor")).toHaveValue(manifestPayload.content);
    await page
      .getByTestId("optidev-manifest-editor")
      .fill(manifestPayload.content.replace("branch: main", "branch: feature/manifest-ui"));
    await expect.element(page.getByText("workspace.branch")).toBeInTheDocument();
    await page.getByTestId("optidev-manifest-save").click({ force: true });
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("Manifest-first workspace ready.");
    await page.getByTestId("optidev-start").click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("start:demo");
    await expect.element(page.getByTestId("optidev-status")).toHaveTextContent("Status: running");
    await page.getByTestId("optidev-open-loops").click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("loop: runtime-ts-002");
    await page.getByTestId("optidev-clone-name").fill("fork-sandbox");
    await page.getByRole("button", { name: "Clone" }).click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("clone:fork-sandbox");

    expect(actionCalls).toEqual([
      { action: "start", target: "demo" },
      { action: "memory_open_loops", target: "demo" },
      { action: "workspace_clone", target: "demo", name: "fork-sandbox" },
    ]);

    await mounted.screen.unmount();
  });

  it("shows a simplified current plugin inventory", async () => {
    const mounted = await mountRoute("/optidev");

    await page.getByTestId("optidev-tab-plugins").click();
    await expect.element(page.getByTestId("optidev-plugin-advice")).toBeInTheDocument();
    await expect.element(page.getByTestId("optidev-plugin-telegram")).toHaveTextContent("Telegram bridge is enabled");
    await expect.element(page.getByTestId("optidev-plugin-skills")).toBeInTheDocument();
    await expect.element(page.getByTestId("optidev-plugin-agents")).toBeInTheDocument();

    await mounted.screen.unmount();
  });

  it("groups machine-local Codex sessions by folder and sorts them by freshness", async () => {
    const mounted = await mountRoute("/optidev");

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await expect.element(page.getByTestId("sidebar-codex-group-demo")).toBeInTheDocument();
    await expect.element(page.getByTestId("sidebar-codex-group-external")).toBeInTheDocument();
    await expect.element(page.getByTestId("sidebar-codex-group-demo")).toHaveTextContent("2");
    await expect.element(page.getByTestId("sidebar-codex-group-demo")).toHaveTextContent(
      "Fix landing hero spacing and keep the CTA visible on mobile.",
    );
    await expect.element(page.getByTestId("sidebar-codex-group-external")).toHaveTextContent("*");
    await page.getByTestId("sidebar-codex-group-demo").click();
    await expect.element(page.getByTestId("sidebar-codex-session-thread-alpha")).toBeInTheDocument();
    await expect.element(page.getByTestId("sidebar-codex-session-thread-gamma")).toBeInTheDocument();
    await expect.element(page.getByTestId("sidebar-codex-session-copy-thread-alpha")).toBeInTheDocument();
    await page.getByTestId("sidebar-codex-group-external").click();
    await expect.element(page.getByTestId("sidebar-codex-session-thread-beta")).toBeInTheDocument();
    await expect.element(page.getByTestId("sidebar-codex-session-copy-thread-beta")).toBeInTheDocument();

    await mounted.screen.unmount();
  });

  it("posts a Codex attach request when a machine-local session row is clicked", async () => {
    const mounted = await mountRoute("/optidev");

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await page.getByTestId("sidebar-codex-group-demo").click();
    await page.getByTestId("sidebar-codex-session-thread-alpha").click();

    await expect
      .poll(() =>
        actionCalls.some(
          (call) => call.action === "codex_connect" && call.identifier === "thread-alpha",
        ),
      )
      .toBe(true);

    await mounted.screen.unmount();
  });

  it("opens the OptiDev settings tab from the sidebar", async () => {
    const mounted = await mountRoute("/optidev");

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await expect.element(page.getByTestId("sidebar-optidev-settings")).toBeInTheDocument();
    await page.getByTestId("sidebar-optidev-settings").click();
    await expect.element(page.getByText("Workspace Manifest")).toBeInTheDocument();

    await mounted.screen.unmount();
  });
});
