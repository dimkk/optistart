import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { OptiDevRouteContext } from "./optidevContract";
import { nativeResetAction, nativeStopAction } from "./optidevLifecycle";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeContext(homeDir: string, cwd: string): OptiDevRouteContext {
  return { homeDir, cwd };
}

describe("optidevLifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resets a running project and stops hook and mux artifacts", async () => {
    const repoRoot = makeTempDir("optidev-lifecycle-root-");
    const homeDir = makeTempDir("optidev-lifecycle-home-");
    const projectPath = path.join(repoRoot, "demo");
    const context = makeContext(homeDir, repoRoot);
    const killGroup = vi.fn();
    const killPid = vi.fn();
    const runCommand = vi.fn();

    fs.mkdirSync(path.join(projectPath, ".optidev"), { recursive: true });
    fs.mkdirSync(path.join(homeDir, "sessions", "demo"), { recursive: true });
    fs.writeFileSync(path.join(projectPath, ".optidev", "session.json"), JSON.stringify({ project: "demo" }), "utf8");
    fs.writeFileSync(
      path.join(homeDir, "active_session.json"),
      JSON.stringify({ project: "demo" }, null, 2),
      "utf8",
    );
    fs.writeFileSync(
      path.join(homeDir, "sessions", "demo", "session.json"),
      JSON.stringify(
        {
          project: "demo",
          status: "running",
          started_at: "2026-03-08T00:00:00.000Z",
          stopped_at: null,
          mux_backend: "zellij",
          mux_session_name: "optid-demo",
          layout_path: path.join(homeDir, "sessions", "demo", "layout.kdl"),
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(homeDir, "sessions", "demo", "hooks.json"),
      JSON.stringify([{ group: "dev.start", command: "npm run dev", pid: 123, status: "running" }], null, 2),
      "utf8",
    );

    const result = await nativeResetAction(context, projectPath, {
      now: () => "2026-03-08T12:00:00.000Z",
      killProcessGroup: killGroup,
      killPid,
      runCommand,
    });

    expect(result.ok).toBe(true);
    expect(result.lines).toEqual([
      "Stopped session 'optid-demo'.",
      "Workspace session reset for project 'demo'.",
    ]);
    expect(killGroup).toHaveBeenCalledWith(123, "SIGTERM");
    expect(runCommand).toHaveBeenCalledWith("zellij", ["kill-session", "optid-demo"]);
    expect(killPid).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(projectPath, ".optidev", "session.json"))).toBe(false);
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo"))).toBe(false);
    expect(fs.readFileSync(path.join(homeDir, "active_session.json"), "utf8")).toContain('"status": "stopped"');
  });

  it("stops the active project and records plugin stop event without deleting session artifacts", async () => {
    const repoRoot = makeTempDir("optidev-lifecycle-root-");
    const homeDir = makeTempDir("optidev-lifecycle-home-");
    const projectPath = path.join(homeDir, "projects", "demo");
    const context = makeContext(homeDir, repoRoot);
    const runCommand = vi.fn();

    fs.mkdirSync(path.join(projectPath, ".optidev"), { recursive: true });
    fs.mkdirSync(path.join(homeDir, "sessions", "demo"), { recursive: true });
    fs.writeFileSync(
      path.join(homeDir, "active_session.json"),
      JSON.stringify({ project: "demo" }, null, 2),
      "utf8",
    );
    fs.writeFileSync(
      path.join(homeDir, "sessions", "demo", "session.json"),
      JSON.stringify(
        {
          project: "demo",
          status: "running",
          started_at: "2026-03-08T00:00:00.000Z",
          stopped_at: null,
          mux_backend: "zellij",
          mux_session_name: "optid-demo",
          layout_path: path.join(homeDir, "sessions", "demo", "layout.kdl"),
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(projectPath, ".optidev", "session.json"),
      JSON.stringify({ project: "demo", status: "running" }),
      "utf8",
    );

    const result = await nativeStopAction(context, {
      now: () => "2026-03-08T12:00:00.000Z",
      runCommand,
    });

    expect(result.ok).toBe(true);
    expect(result.lines).toEqual(["Stopped session 'optid-demo'."]);
    expect(runCommand).toHaveBeenCalledWith("zellij", ["kill-session", "optid-demo"]);
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo"))).toBe(true);
    expect(fs.readFileSync(path.join(projectPath, ".optidev", "session.json"), "utf8")).toContain('"status": "stopped"');
    expect(fs.readFileSync(path.join(homeDir, "plugins", "telegram-events.jsonl"), "utf8")).toContain("workspace_stop");
  });

  it("resets session artifacts even when the project is not active", async () => {
    const repoRoot = makeTempDir("optidev-lifecycle-root-");
    const homeDir = makeTempDir("optidev-lifecycle-home-");
    const projectPath = path.join(repoRoot, "demo");
    const context = makeContext(homeDir, repoRoot);

    fs.mkdirSync(path.join(projectPath, ".optidev"), { recursive: true });
    fs.mkdirSync(path.join(homeDir, "sessions", "demo"), { recursive: true });
    fs.writeFileSync(path.join(projectPath, ".optidev", "session.json"), JSON.stringify({ project: "demo" }), "utf8");

    const result = await nativeResetAction(context, projectPath);

    expect(result.ok).toBe(true);
    expect(result.lines).toEqual(["Workspace session reset for project 'demo'."]);
    expect(fs.existsSync(path.join(projectPath, ".optidev", "session.json"))).toBe(false);
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo"))).toBe(false);
  });
});
