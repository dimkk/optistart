import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { vi } from "vitest";
import { afterEach, describe, expect, it } from "vitest";

import { runOptiDevCli } from "./optidevCli";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeRuntime(homeDir: string, cwd: string) {
  let stdout = "";
  let stderr = "";
  return {
    runtime: {
      cwd,
      env: {
        ...process.env,
        OPTIDEV_HOME: homeDir,
      },
      streams: {
        stdout: { write(chunk: string) { stdout += chunk; } },
        stderr: { write(chunk: string) { stderr += chunk; } },
      },
    },
    readStdout: () => stdout,
    readStderr: () => stderr,
  };
}

describe("optidevCli", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("starts and resumes a project through the native CLI runtime with advice enabled by default", async () => {
    const repoRoot = makeTempDir("optidev-cli-root-");
    const homeDir = makeTempDir("optidev-cli-home-");
    const projectDir = path.join(homeDir, "projects", "demo");
    const { runtime, readStdout, readStderr } = makeRuntime(homeDir, repoRoot);

    fs.mkdirSync(path.join(projectDir, ".project"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, ".project", "config.yaml"),
      JSON.stringify({ dev: { start: [] }, tests: { command: null, watch: [] }, logs: { sources: [] } }, null, 2),
      "utf8",
    );
    fs.writeFileSync(path.join(homeDir, "config.yaml"), "mux_backend: textual\ndefault_runner: claude\n", "utf8");

    const started = await runOptiDevCli(["start", "demo"], runtime);
    const resumed = await runOptiDevCli(["resume", "demo"], runtime);

    expect(started).toBe(0);
    expect(resumed).toBe(0);
    expect(readStderr()).toBe("");
    expect(readStdout()).toContain("OptiDev workspace ready.");
    expect(readStdout()).toContain("Runner ready: claude.");
    expect(readStdout()).toContain("Advice mode: startup repo analysis prompt queued for the runner.");
    expect(readStdout()).toContain("Session restored.");
    expect(readStdout()).toContain("Open /optidev in the forked t3 UI.");
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo", "session.json"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, ".optidev", "session.json"))).toBe(true);
  });

  it("supports --no-advice for quieter startup", async () => {
    const repoRoot = makeTempDir("optidev-cli-root-");
    const homeDir = makeTempDir("optidev-cli-home-");
    const projectDir = path.join(homeDir, "projects", "demo");
    const { runtime, readStdout, readStderr } = makeRuntime(homeDir, repoRoot);

    fs.mkdirSync(path.join(projectDir, ".project"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, ".project", "config.yaml"),
      JSON.stringify({ dev: { start: [] }, tests: { command: null, watch: [] }, logs: { sources: [] } }, null, 2),
      "utf8",
    );
    fs.writeFileSync(path.join(homeDir, "config.yaml"), "mux_backend: textual\ndefault_runner: claude\n", "utf8");

    const started = await runOptiDevCli(["start", "demo", "--no-advice"], runtime);

    expect(started).toBe(0);
    expect(readStderr()).toBe("");
    expect(readStdout()).toContain("OptiDev workspace ready.");
    expect(readStdout()).not.toContain("Advice mode: startup repo analysis prompt queued for the runner.");
  });

  it("handles telegram lifecycle commands through the native CLI runtime", async () => {
    const homeDir = makeTempDir("optidev-cli-home-");
    const cwd = makeTempDir("optidev-cli-cwd-");
    const { runtime, readStdout, readStderr } = makeRuntime(homeDir, cwd);

    const started = await runOptiDevCli(
      ["telegram", "start", "--token", "123456:ABCDEF", "--chat-id", "42"],
      runtime,
    );
    const status = await runOptiDevCli(["telegram", "status"], runtime);
    const stopped = await runOptiDevCli(["telegram", "stop"], runtime);

    expect(started).toBe(0);
    expect(status).toBe(0);
    expect(stopped).toBe(0);
    expect(readStderr()).toBe("");
    expect(readStdout()).toContain("Telegram bridge enabled for chat 42.");
    expect(readStdout()).toContain("Telegram bridge is enabled for chat 42");
    expect(readStdout()).toContain("Telegram bridge disabled.");
    expect(fs.existsSync(path.join(homeDir, "plugins", "telegram-config.json"))).toBe(true);
  });

  it("initializes a project and clones a workspace manifest through the native CLI runtime", async () => {
    const repoRoot = makeTempDir("optidev-cli-root-");
    const homeDir = makeTempDir("optidev-cli-home-");
    const initRuntime = makeRuntime(homeDir, repoRoot);

    const initialized = await runOptiDevCli(["init", "demo"], initRuntime.runtime);

    expect(initialized).toBe(0);
    expect(initRuntime.readStdout()).toContain("Initialized project 'demo'");

    const projectDir = path.join(repoRoot, "demo");
    const cloneRuntime = makeRuntime(homeDir, projectDir);
    const cloned = await runOptiDevCli(["workspace", "clone", "feature-x"], cloneRuntime.runtime);

    expect(cloned).toBe(0);
    expect(cloneRuntime.readStdout()).toContain("Workspace clone created");
    expect(fs.existsSync(path.join(projectDir, ".optidev", "workspace.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, ".optidev", "workspaces", "feature-x", "workspace.yaml"))).toBe(true);
  });

  it("renders memory commands through the native CLI runtime", async () => {
    const projectDir = makeTempDir("optidev-cli-memory-project-");
    const homeDir = makeTempDir("optidev-cli-memory-home-");
    const { runtime, readStdout, readStderr } = makeRuntime(homeDir, projectDir);

    fs.mkdirSync(path.join(projectDir, "docs", "tasks"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "docs", "features", "runtime", "runtime-ts-002"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "docs", "v1-2"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "tasks-log"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "docs", "tasks", "task7-init.md"), "# Task 7\n", "utf8");
    fs.writeFileSync(path.join(projectDir, "docs", "tasks", "task7-init-features.md"), "runtime-ts-002\n", "utf8");
    fs.writeFileSync(
      path.join(projectDir, "docs", "features", "runtime", "runtime-ts-002", "runtime-ts-002-staged-ts-runtime-migration.md"),
      "# runtime-ts-002: staged TS runtime migration\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(projectDir, "docs", "v1-2", "features-matrix.md"),
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
      path.join(projectDir, "tasks-log", "task-029-runtime-ts-native-only-report.md"),
      ["# Task 029", "", "## Decisions", "- native CLI only"].join("\n"),
      "utf8",
    );

    const summary = await runOptiDevCli(["memory"], runtime);
    const show = await runOptiDevCli(["memory", "show", "feature", "runtime-ts-002"], runtime);

    expect(summary).toBe(0);
    expect(show).toBe(0);
    expect(readStderr()).toBe("");
    expect(readStdout()).toContain("Project memory:");
    expect(readStdout()).toContain("Feature: runtime-ts-002");
  });

  it("lists and resumes runner sessions through the native CLI runtime", async () => {
    const homeDir = makeTempDir("optidev-cli-home-");
    const cwd = makeTempDir("optidev-cli-cwd-");
    const { runtime, readStdout, readStderr } = makeRuntime(homeDir, cwd);
    runtime.env.OPTID_SERVER_URL = "http://127.0.0.1:4020";

    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
      if (body.action === "runner_list") {
        return new Response(
          JSON.stringify({
            ok: true,
            lines: [
              "1. runner=codex | guid=thread-alpha | cwd=/repo/demo | user=\"Fix landing hero spacing and keep the CTA visible on mobile.\" | runtime=running | session=running",
            ],
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

    const listed = await runOptiDevCli(["runner", "ls"], runtime);
    const resumed = await runOptiDevCli(["runner", "resume", "1"], runtime);

    expect(listed).toBe(0);
    expect(resumed).toBe(0);
    expect(readStderr()).toBe("");
    expect(readStdout()).toContain("1. runner=codex | guid=thread-alpha");
    expect(readStdout()).toContain("Resolved runner 1 -> thread-alpha.");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
