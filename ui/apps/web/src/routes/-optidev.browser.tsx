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
let telegramConfig = { botToken: "token-1", chatId: "42" };
let pluginContent = "# Reviewer\n";

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

    if (scope === "repo") {
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
    }

    return HttpResponse.json({
      ok: true,
      data: {
        scope,
        path: currentPath,
        entries: [{ name: "reviewer.md", path: "reviewer.md", kind: "file", size: pluginContent.length }],
      },
    });
  }),
  http.get("/api/optidev/fs/read", ({ request }) => {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const currentPath = url.searchParams.get("path");

    if (scope === "repo" && currentPath === "README.md") {
      return HttpResponse.json({
        ok: true,
        data: {
          scope,
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

    return HttpResponse.json({
      ok: true,
      data: {
        scope,
        path: currentPath,
        name: "reviewer.md",
        kind: "markdown",
        language: "markdown",
        content: pluginContent,
        size: pluginContent.length,
        editable: true,
      },
    });
  }),
  http.post("/api/optidev/fs/write", async ({ request }) => {
    const payload = (await request.json()) as { path: string; content: string };
    pluginContent = payload.content;
    return HttpResponse.json({
      ok: true,
      lines: [`Saved ${payload.path}.`],
      data: {
        scope: "agents",
        path: payload.path,
        name: payload.path.split("/").at(-1),
        kind: "markdown",
        language: "markdown",
        content: payload.content,
        size: payload.content.length,
        editable: true,
      },
    });
  }),
  http.get("/api/optidev/telegram-config", () =>
    HttpResponse.json({
      ok: true,
      data: telegramConfig,
    }),
  ),
  http.post("/api/optidev/telegram-config", async ({ request }) => {
    telegramConfig = (await request.json()) as typeof telegramConfig;
    return HttpResponse.json({
      ok: true,
      lines: ["Telegram settings saved."],
      data: telegramConfig,
    });
  }),
  http.post("/api/optidev/action", async ({ request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    actionCalls.push(payload);

    const action = String(payload.action ?? "");
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
    if (action === "plugin") {
      return HttpResponse.json({
        ok: true,
        lines: [`plugin:${String(payload.command ?? "")}:${String((payload.args as string[] | undefined)?.[0] ?? "")}`],
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
      logs: "Log sources:\nnpm run dev [running]",
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
    telegramConfig = { botToken: "token-1", chatId: "42" };
    pluginContent = "# Reviewer\n";
    actionCalls.length = 0;
  });

  afterEach(() => {
    worker.resetHandlers();
  });

  it("navigates from the shell into the OptiDev route", async () => {
    const mounted = await mountRoute("/");

    await expect.element(page.getByTestId("open-optidev")).toBeInTheDocument();
    await page.getByTestId("open-optidev").click();
    await expect.poll(() => mounted.history.location.pathname).toBe("/optidev");
    await expect.element(page.getByText("OptiDev Workspace")).toBeInTheDocument();

    await mounted.screen.unmount();
  });

  it("supports files and session actions from the integrated tabs", async () => {
    const mounted = await mountRoute("/optidev");

    await expect.element(page.getByText("Repository Files")).toBeInTheDocument();
    await page.getByTestId("optidev-entry-repo-README.md").click();
    await expect.element(page.getByText("Hello from OptiDev.")).toBeInTheDocument();
    await page.getByText("Source").click();
    await expect.element(page.getByText("# Demo")).toBeInTheDocument();

    await page.getByTestId("optidev-tab-optidev").click();
    await expect.element(page.getByTestId("optidev-status")).toHaveTextContent("Status: idle");
    await page.getByTestId("optidev-target").fill("demo");
    await page.getByTestId("optidev-start").click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("start:demo");
    await expect.element(page.getByTestId("optidev-status")).toHaveTextContent("Status: running");
    await page.getByTestId("optidev-open-loops").click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("loop: runtime-ts-002");
    await page.getByTestId("optidev-advice").click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("plugin:advice:");
    await page.getByTestId("optidev-clone-name").fill("fork-sandbox");
    await page.getByRole("button", { name: "Clone" }).click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("clone:fork-sandbox");

    expect(actionCalls).toEqual([
      { action: "start", target: "demo" },
      { action: "memory_open_loops", target: "demo" },
      { action: "plugin", command: "advice", args: [] },
      { action: "workspace_clone", target: "demo", name: "fork-sandbox" },
    ]);

    await mounted.screen.unmount();
  });

  it("supports plugin creation and Telegram settings from the plugins tab", async () => {
    const mounted = await mountRoute("/optidev");

    await page.getByTestId("optidev-tab-plugins").click();
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByTestId("optidev-plugin-editor").fill("# Reviewer\nUpdated\n");
    await page.getByTestId("optidev-plugin-save").click({ force: true });
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("Saved new-entry.md.");
    await page.getByTestId("optidev-telegram-token").fill("token-2");
    await page.getByTestId("optidev-telegram-chat-id").fill("77");
    await page.getByTestId("optidev-telegram-save").click({ force: true });
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("Telegram settings saved.");

    await mounted.screen.unmount();
  });
});
