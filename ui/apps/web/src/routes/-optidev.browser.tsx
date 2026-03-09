import "../index.css";

import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";
import { page } from "vitest/browser";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { getRouter } from "../router";

interface OptiDevStateFixture {
  status: string;
  logs: string;
  projects: Array<{ name: string; path: string }>;
  memorySummary: string[];
}

let fixture: OptiDevStateFixture;
const actionCalls: Array<Record<string, unknown>> = [];

const worker = setupWorker(
  http.get("/api/optidev/state", () =>
    HttpResponse.json({
      ok: true,
      state: fixture,
    }),
  ),
  http.post("/api/optidev/action", async ({ request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    actionCalls.push(payload);

    const action = String(payload.action ?? "");
    if (action === "start") {
      fixture = {
        ...fixture,
        status: "Status: running",
      };
      return HttpResponse.json({
        ok: true,
        lines: [`start:${String(payload.target ?? ".")}`],
      });
    }
    if (action === "memory_open_loops") {
      return HttpResponse.json({
        ok: true,
        lines: ["loop: ui-t3code-001"],
      });
    }
    if (action === "plugin") {
      return HttpResponse.json({
        ok: true,
        lines: [`plugin:${String(payload.command ?? "")}`],
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
      status: "Status: idle",
      logs: "Logs: /tmp/optidev.log",
      projects: [
        {
          name: "demo",
          path: "/repo/demo",
        },
      ],
      memorySummary: ["Feature ui-t3code-001 is active."],
    };
    actionCalls.length = 0;
  });

  afterEach(() => {
    worker.resetHandlers();
  });

  it("navigates from the forked chat shell into the OptiDev route", async () => {
    const mounted = await mountRoute("/");

    await expect.element(page.getByTestId("open-optidev")).toBeInTheDocument();
    await page.getByTestId("open-optidev").click();
    await expect.poll(() => mounted.history.location.pathname).toBe("/optidev");
    await expect.element(page.getByTestId("optidev-state-card")).toBeInTheDocument();

    await mounted.screen.unmount();
  });

  it("renders OptiDev state and dispatches fork-integrated actions", async () => {
    const mounted = await mountRoute("/optidev");

    await expect.element(page.getByTestId("optidev-status")).toHaveTextContent("Status: idle");
    await expect.element(page.getByTestId("optidev-projects")).toHaveTextContent("demo");
    await expect.element(page.getByTestId("optidev-projects")).toHaveTextContent("/repo/demo");

    await page.getByTestId("optidev-target").fill("demo");
    await page.getByTestId("optidev-start").click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("start:demo");
    await expect.element(page.getByTestId("optidev-status")).toHaveTextContent("Status: running");

    await page.getByTestId("optidev-open-loops").click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("loop: ui-t3code-001");

    await page.getByTestId("optidev-advice").click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("plugin:advice");

    await page.getByTestId("optidev-clone-name").fill("fork-sandbox");
    await page.getByText("Clone Workspace").click();
    await expect.element(page.getByTestId("optidev-output")).toHaveTextContent("clone:fork-sandbox");

    expect(actionCalls).toEqual([
      { action: "start", target: "demo" },
      { action: "memory_open_loops", target: "demo" },
      { action: "plugin", command: "advice", args: [] },
      { action: "workspace_clone", name: "fork-sandbox", target: "demo" },
    ]);

    await mounted.screen.unmount();
  });
});
