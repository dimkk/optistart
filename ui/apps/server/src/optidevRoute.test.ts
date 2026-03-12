import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveOptiDevProjectRoot, tryHandleOptiDevRequest } from "./optidevRoute";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createMockRepoRoot(): { repoRoot: string; uiRoot: string } {
  const repoRoot = makeTempDir("optidev-route-root-");
  fs.mkdirSync(path.join(repoRoot, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "scripts", "optid"), "#!/usr/bin/env bash\n", "utf8");
  const uiRoot = path.join(repoRoot, "ui");
  fs.mkdirSync(path.join(uiRoot, "apps", "server"), { recursive: true });
  fs.mkdirSync(path.join(uiRoot, "apps", "web"), { recursive: true });
  return { repoRoot, uiRoot };
}

function seedNativeOptiDevHome(homeDir: string, projectName = "demo") {
  const projectPath = path.join(homeDir, "projects", projectName);
  fs.mkdirSync(path.join(homeDir, "projects"), { recursive: true });
  fs.mkdirSync(path.join(homeDir, "sessions", projectName), { recursive: true });
  fs.mkdirSync(path.join(projectPath, ".optidev"), { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, "active_session.json"),
    JSON.stringify({ project: projectName }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(homeDir, "sessions", projectName, "session.json"),
    JSON.stringify(
      {
        project: projectName,
        status: "running",
        mux_backend: "zellij",
        mux_session_name: `optid-${projectName}`,
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(homeDir, "sessions", projectName, "runner.json"),
    JSON.stringify({ runner: "codex" }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(homeDir, "sessions", projectName, "hooks.json"),
    JSON.stringify([{ group: "logs.sources", command: "npm run dev", status: "running" }], null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectPath, ".optidev", "workspace.yaml"),
    "project: demo\nworkspace:\n  active_task: ship-it\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectPath, ".optidev", "session.json"),
    JSON.stringify(
      {
        branch: "main",
        head_commit: "1234567890abcdef",
        agents: ["coder", "reviewer"],
        last_mode: "resume",
        active_task: "ship-it",
      },
      null,
      2,
    ),
    "utf8",
  );
  return projectPath;
}

async function withRouteServer(
  options: {
    cwd: string;
    homeDir?: string;
  },
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer((req, res) => {
    let requestBody = "";
    req.on("data", (chunk) => {
      requestBody += Buffer.from(chunk).toString("utf8");
    });
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      void tryHandleOptiDevRequest(req, url, requestBody, res, options);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected server address to be an object");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

describe("optidevRoute", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves the OptiDev project root from the forked ui workspace", () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();

    expect(resolveOptiDevProjectRoot(uiRoot)).toBe(repoRoot);
    expect(resolveOptiDevProjectRoot(repoRoot)).toBe(repoRoot);
    expect(resolveOptiDevProjectRoot(path.join(uiRoot, "apps", "server"))).toBe(repoRoot);
  });

  it("serves health for the embedded route without spawning OptiDev", async () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();

    await withRouteServer({ cwd: uiRoot }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/optidev/health`);
      const body = (await response.json()) as { ok: boolean; root: string };

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.root).toBe(repoRoot);
    });
  });

  it("serves state entirely through native TS read-only logic once memory is migrated", async () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");
    seedNativeOptiDevHome(homeDir, "demo");
    fs.mkdirSync(path.join(repoRoot, ".optidev"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "docs", "tasks"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "docs", "features", "runtime", "runtime-ts-002"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(repoRoot, "docs", "v1-2"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "tasks-log"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, ".optidev", "session.json"), JSON.stringify({ active_task: "ship-it" }), "utf8");
    fs.writeFileSync(path.join(repoRoot, "docs", "tasks", "task7-init.md"), "# Task 7\n", "utf8");
    fs.writeFileSync(
      path.join(repoRoot, "docs", "tasks", "task7-init-features.md"),
      "runtime-ts-002\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(repoRoot, "docs", "features", "runtime", "runtime-ts-002", "runtime-ts-002-staged-ts-runtime-migration.md"),
      "# runtime-ts-002: staged TS runtime migration\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(repoRoot, "docs", "v1-2", "features-matrix.md"),
      [
        "# Features v1-2",
        "",
        "| Feature ID | Title | Status |",
        "| --- | --- | --- |",
        "| runtime-ts-002 | Runtime migration | DONE |",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(repoRoot, "tasks-log", "task-022-runtime-ts-slice1-report.md"),
      ["# Task 022", "", "## Open loops", "- still migrating memory", "", "## Decisions", "- stay incremental"].join("\n"),
      "utf8",
    );

    await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/optidev/state`);
      const body = (await response.json()) as {
        ok: boolean;
        state: {
          repoRoot: string;
          status: string;
          projects: Array<{ name: string; path: string }>;
          memorySummary: string[];
          session: {
            project: string | null;
            runner: string | null;
          };
        };
      };

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.state.repoRoot).toBe(repoRoot);
      expect(body.state.status).toContain("Project: demo");
      expect(body.state.status).toContain("Task: ship-it");
      expect(body.state.session.project).toBe("demo");
      expect(body.state.session.runner).toBe("codex");
      expect(body.state.projects).toEqual([{ name: "demo", path: path.join(homeDir, "projects", "demo") }]);
      expect(body.state.memorySummary.join("\n")).toContain("Project memory:");
      expect(body.state.memorySummary.join("\n")).toContain("active feature: ship-it");
    });
  });

  it("serves repository file listings and previews through native endpoints", async () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();
    fs.mkdirSync(path.join(repoRoot, "docs"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "README.md"), "# OptiDev\n", "utf8");
    fs.writeFileSync(path.join(repoRoot, "docs", "guide.md"), "hello\n", "utf8");

    await withRouteServer({ cwd: uiRoot }, async (baseUrl) => {
      const listing = await fetch(`${baseUrl}/api/optidev/fs/list?scope=repo&path=`);
      const preview = await fetch(
        `${baseUrl}/api/optidev/fs/read?scope=repo&path=${encodeURIComponent("README.md")}`,
      );

      const listingBody = (await listing.json()) as {
        ok: boolean;
        data: { entries: Array<{ name: string; kind: string }> };
      };
      const previewBody = (await preview.json()) as {
        ok: boolean;
        data: { kind: string; content: string };
      };

      expect(listing.status).toBe(200);
      expect(listingBody.data.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "docs", kind: "directory" }),
          expect.objectContaining({ name: "README.md", kind: "file" }),
        ]),
      );
      expect(preview.status).toBe(200);
      expect(previewBody.data.kind).toBe("markdown");
      expect(previewBody.data.content).toContain("# OptiDev");
    });
  });

  it("saves plugin files and Telegram config through native endpoints", async () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");
    fs.mkdirSync(path.join(repoRoot, ".agents", "agents"), { recursive: true });

    await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
      const saveFile = await fetch(`${baseUrl}/api/optidev/fs/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "agents",
          path: "reviewer/SKILL.md",
          content: "# Reviewer\n",
        }),
      });
      const saveTelegram = await fetch(`${baseUrl}/api/optidev/telegram-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: "token-123",
          chatId: "42",
        }),
      });
      const readTelegram = await fetch(`${baseUrl}/api/optidev/telegram-config`);

      const saveFileBody = (await saveFile.json()) as { ok: boolean; lines: string[] };
      const saveTelegramBody = (await saveTelegram.json()) as {
        ok: boolean;
        data: { botToken: string; chatId: string };
      };
      const readTelegramBody = (await readTelegram.json()) as {
        ok: boolean;
        data: { botToken: string; chatId: string };
      };

      expect(saveFile.status).toBe(200);
      expect(saveFileBody.lines[0]).toContain("Saved reviewer/SKILL.md.");
      expect(
        fs.readFileSync(path.join(repoRoot, ".agents", "agents", "reviewer", "SKILL.md"), "utf8"),
      ).toContain("# Reviewer");

      expect(saveTelegram.status).toBe(200);
      expect(saveTelegramBody.data).toEqual({ botToken: "token-123", chatId: "42" });
      expect(readTelegramBody.data).toEqual({ botToken: "token-123", chatId: "42" });
      expect(fs.readFileSync(path.join(homeDir, "config.yaml"), "utf8")).toContain("telegram_bot_token");
    });
  });

  it("rejects invalid JSON request bodies", async () => {
    const { uiRoot } = createMockRepoRoot();

    await withRouteServer({ cwd: uiRoot }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad json",
      });
      const body = (await response.json()) as { ok: boolean; lines: string[] };

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.lines).toEqual(["Invalid JSON body."]);
    });
  });

  it("rejects unknown OptiDev actions without a compatibility bridge", async () => {
    const { uiRoot } = createMockRepoRoot();

    await withRouteServer({ cwd: uiRoot }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mystery_action" }),
      });
      const body = (await response.json()) as { ok: boolean; lines: string[] };

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.lines).toEqual(["Unsupported OptiDev action: mystery_action."]);
    });
  });

  it("rejects unknown plugin action requests without a Python fallback", async () => {
    const { uiRoot } = createMockRepoRoot();

    await withRouteServer({ cwd: uiRoot }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "plugin",
          command: "mystery",
          args: ["arg"],
        }),
      });
      const body = (await response.json()) as { ok: boolean; lines: string[] };

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.lines).toEqual(["Unsupported plugin command: mystery."]);
    });
  });

  it("serves native status action without fallback", async () => {
    const { uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");
    seedNativeOptiDevHome(homeDir, "demo");

    await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status" }),
      });
      const body = (await response.json()) as { ok: boolean; lines: string[] };

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.lines[0]).toContain("Project: demo");
    });
  });

  it("serves native memory actions without fallback", async () => {
    const { uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");
    const projectPath = seedNativeOptiDevHome(homeDir, "demo");
    fs.mkdirSync(path.join(projectPath, "docs", "tasks"), { recursive: true });
    fs.mkdirSync(path.join(projectPath, "docs", "features", "runtime", "runtime-ts-002"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(projectPath, "docs", "v1-2"), { recursive: true });
    fs.mkdirSync(path.join(projectPath, "tasks-log"), { recursive: true });
    fs.writeFileSync(path.join(projectPath, "docs", "tasks", "task7-init.md"), "# Task 7\n", "utf8");
    fs.writeFileSync(
      path.join(projectPath, "docs", "tasks", "task7-init-features.md"),
      "runtime-ts-002\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(projectPath, "docs", "features", "runtime", "runtime-ts-002", "runtime-ts-002-staged-ts-runtime-migration.md"),
      "# runtime-ts-002: staged TS runtime migration\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(projectPath, "docs", "v1-2", "features-matrix.md"),
      [
        "# Features v1-2",
        "",
        "| Feature ID | Title | Status |",
        "| --- | --- | --- |",
        "| runtime-ts-002 | Runtime migration | DONE |",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(projectPath, "tasks-log", "task-022-runtime-ts-slice1-report.md"),
      ["# Task 022", "", "## Open loops", "- memory show parity", "", "## Decisions", "- keep behavior stable"].join("\n"),
      "utf8",
    );

    await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
      const summary = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "memory_summary", target: "demo" }),
      });
      const show = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "memory_show",
          target: "demo",
          kind: "feature",
          identifier: "runtime-ts-002",
        }),
      });

      const summaryBody = (await summary.json()) as { ok: boolean; lines: string[] };
      const showBody = (await show.json()) as { ok: boolean; lines: string[] };

      expect(summary.status).toBe(200);
      expect(summaryBody.lines.join("\n")).toContain("Project memory:");
      expect(show.status).toBe(200);
      expect(showBody.lines).toContain("Feature: runtime-ts-002");
    });
  });

  it("serves native init action without fallback", async () => {
    const { uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");

    await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init", target: "demo" }),
      });
      const body = (await response.json()) as { ok: boolean; lines: string[] };

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.lines[0]).toContain("Initialized project 'demo'");
      expect(fs.existsSync(path.join(resolveOptiDevProjectRoot(uiRoot), "demo", ".optidev", "workspace.yaml"))).toBe(true);
    });
  });

  it("serves native workspace clone action without fallback", async () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");

    fs.mkdirSync(path.join(repoRoot, ".optidev"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".project"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".project", "config.yaml"),
      JSON.stringify({ dev: { start: [] }, tests: { command: null, watch: [] }, logs: { sources: [] } }, null, 2),
      "utf8",
    );
    fs.writeFileSync(path.join(repoRoot, ".optidev", "workspace.yaml"), "project: optistart\nworkspace:\n  branch: main\n", "utf8");

    await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "workspace_clone", target: ".", name: "sandbox" }),
      });
      const body = (await response.json()) as { ok: boolean; lines: string[] };

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.lines[0]).toContain("Workspace clone created");
      expect(fs.existsSync(path.join(repoRoot, ".optidev", "workspaces", "sandbox", "workspace.yaml"))).toBe(true);
    });
  });

  it("serves native reset action without fallback", async () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");
    const projectName = path.basename(repoRoot);

    fs.mkdirSync(path.join(repoRoot, ".optidev"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, ".optidev", "session.json"), JSON.stringify({ project: projectName }), "utf8");
    fs.mkdirSync(path.join(homeDir, "sessions", projectName), { recursive: true });
    fs.writeFileSync(
      path.join(homeDir, "active_session.json"),
      JSON.stringify({ project: projectName }, null, 2),
      "utf8",
    );
    fs.writeFileSync(
      path.join(homeDir, "sessions", projectName, "session.json"),
      JSON.stringify(
        {
          project: projectName,
          status: "running",
          started_at: "2026-03-08T00:00:00.000Z",
          stopped_at: null,
          mux_backend: "textual",
          mux_session_name: `optid-${projectName}`,
          layout_path: path.join(homeDir, "sessions", projectName, "layout.textual.json"),
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(homeDir, "sessions", projectName, "hooks.json"),
      JSON.stringify([], null, 2),
      "utf8",
    );

    await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", target: "." }),
      });
      const body = (await response.json()) as { ok: boolean; lines: string[] };

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.lines.join("\n")).toContain(`Workspace session reset for project '${projectName}'.`);
      expect(fs.existsSync(path.join(repoRoot, ".optidev", "session.json"))).toBe(false);
      expect(fs.existsSync(path.join(homeDir, "sessions", projectName))).toBe(false);
    });
  });

  it("serves native start and resume actions without fallback", async () => {
    const { uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");
    const projectPath = path.join(homeDir, "projects", "demo");

    fs.mkdirSync(path.join(projectPath, ".project"), { recursive: true });
    fs.writeFileSync(
      path.join(projectPath, ".project", "config.yaml"),
      JSON.stringify({ dev: { start: [] }, tests: { command: null, watch: [] }, logs: { sources: [] } }, null, 2),
      "utf8",
    );
    fs.writeFileSync(path.join(homeDir, "config.yaml"), "mux_backend: textual\ndefault_runner: claude\n", "utf8");

    await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
      const start = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", target: "demo", advice: true }),
      });
      const resume = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume", target: "demo" }),
      });

      const startBody = (await start.json()) as { ok: boolean; lines: string[] };
      const resumeBody = (await resume.json()) as { ok: boolean; lines: string[] };

      expect(start.status).toBe(200);
      expect(startBody.ok).toBe(true);
      expect(startBody.lines.join("\n")).toContain("OptiDev workspace ready.");
      expect(startBody.lines.join("\n")).toContain("Runner ready: claude.");
      expect(fs.existsSync(path.join(homeDir, "sessions", "demo", "runner.json"))).toBe(true);
      expect(resume.status).toBe(200);
      expect(resumeBody.ok).toBe(true);
      expect(resumeBody.lines.join("\n")).toContain("Session restored.");
    });
  });

  it("serves native stop and plugin advice actions without fallback", async () => {
    const { uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");
    const projectPath = path.join(homeDir, "projects", "demo");

    fs.mkdirSync(path.join(projectPath, ".project"), { recursive: true });
    fs.writeFileSync(
      path.join(projectPath, ".project", "config.yaml"),
      JSON.stringify({ dev: { start: [] }, tests: { command: null, watch: [] }, logs: { sources: [] } }, null, 2),
      "utf8",
    );
    fs.writeFileSync(path.join(homeDir, "config.yaml"), "mux_backend: textual\n", "utf8");

    await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
      await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", target: "demo" }),
      });

      const plugin = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "plugin", command: "advice", args: [], target: "demo" }),
      });
      const stop = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });

      const pluginBody = (await plugin.json()) as { ok: boolean; lines: string[] };
      const stopBody = (await stop.json()) as { ok: boolean; lines: string[] };

      expect(plugin.status).toBe(200);
      expect(pluginBody.ok).toBe(true);
      expect(pluginBody.lines[0]).toContain(`- root: ${projectPath}`);
      expect(stop.status).toBe(200);
      expect(stopBody.ok).toBe(true);
      expect(stopBody.lines[0]).toContain("Stopped session");
    });
  });

  it("serves native go action without fallback", async () => {
    const { repoRoot, uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");

    fs.writeFileSync(path.join(homeDir, "config.yaml"), "mux_backend: textual\n", "utf8");

    await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/optidev/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "go", target: "demo" }),
      });
      const body = (await response.json()) as { ok: boolean; lines: string[] };

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.lines.join("\n")).toContain("Initialized project 'demo'");
      expect(body.lines.join("\n")).toContain("OptiDev workspace ready.");
      expect(fs.existsSync(path.join(repoRoot, "demo", ".project", "config.yaml"))).toBe(true);
    });
  });

  it("serves native skills and agents plugin actions without fallback", async () => {
    const { uiRoot } = createMockRepoRoot();
    const homeDir = makeTempDir("optidev-native-home-");
    const projectPath = path.join(homeDir, "projects", "demo");
    const fakeBinDir = makeTempDir("optidev-native-bin-");
    const fakeNpx = path.join(fakeBinDir, "npx");
    const originalSkillsNpx = process.env.OPTIDEV_SKILLS_NPX;
    const originalAgentsBaseUrl = process.env.OPTIDEV_AGENTS_BASE_URL;

    fs.mkdirSync(projectPath, { recursive: true });
    fs.writeFileSync(
      fakeNpx,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "if [[ \"$3\" == \"find\" ]]; then",
        "  echo \"demo-skill\"",
        "  exit 0",
        "fi",
        "if [[ \"$3\" == \"add\" ]]; then",
        "  mkdir -p \"$CODEX_HOME/skills/demo-skill\"",
        "  echo \"Skill: demo\" > \"$CODEX_HOME/skills/demo-skill/SKILL.md\"",
        "  exit 0",
        "fi",
        "exit 1",
      ].join("\n"),
      "utf8",
    );
    fs.chmodSync(fakeNpx, 0o755);
    process.env.OPTIDEV_SKILLS_NPX = fakeNpx;

    const agentServer = http.createServer((req, res) => {
      if (req.url === "/agents?q=code") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end('<a href="/agents/codegpt"></a>');
        return;
      }
      if (req.url === "/agents/codegpt") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          '<script type="application/ld+json">' +
            '{"@context":"https://schema.org","@type":"SoftwareApplication","name":"CodeGPT","description":"Agent desc","url":"https://codegpt.example","applicationCategory":"Software Engineering"}' +
          "</script>",
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => agentServer.listen(0, "127.0.0.1", () => resolve()));

    try {
      const address = agentServer.address();
      if (typeof address !== "object" || address === null) {
        throw new Error("Expected http server address");
      }
      process.env.OPTIDEV_AGENTS_BASE_URL = `http://127.0.0.1:${address.port}`;

      await withRouteServer({ cwd: uiRoot, homeDir }, async (baseUrl) => {
        const skills = await fetch(`${baseUrl}/api/optidev/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "plugin", command: "skills", args: ["search", "demo"], target: "demo" }),
        });
        const agents = await fetch(`${baseUrl}/api/optidev/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "plugin", command: "agents", args: ["search", "code"], target: "demo" }),
        });

        const skillsBody = (await skills.json()) as { ok: boolean; lines: string[] };
        const agentsBody = (await agents.json()) as { ok: boolean; lines: string[] };

        expect(skills.status).toBe(200);
        expect(skillsBody.ok).toBe(true);
        expect(skillsBody.lines).toContain("demo-skill");
        expect(agents.status).toBe(200);
        expect(agentsBody.ok).toBe(true);
        expect(agentsBody.lines[0]).toContain("codegpt - CodeGPT");
      });
    } finally {
      if (originalSkillsNpx === undefined) {
        delete process.env.OPTIDEV_SKILLS_NPX;
      } else {
        process.env.OPTIDEV_SKILLS_NPX = originalSkillsNpx;
      }
      if (originalAgentsBaseUrl === undefined) {
        delete process.env.OPTIDEV_AGENTS_BASE_URL;
      } else {
        process.env.OPTIDEV_AGENTS_BASE_URL = originalAgentsBaseUrl;
      }
      await new Promise<void>((resolve, reject) => agentServer.close((error?: Error) => (error ? reject(error) : resolve())));
    }
  });
});
