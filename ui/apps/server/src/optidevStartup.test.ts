import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { OptiDevRouteContext } from "./optidevContract";
import { nativeResumeAction, nativeStartAction, nativeGoAction } from "./optidevStartup";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeContext(homeDir: string, cwd: string): OptiDevRouteContext {
  return { homeDir, cwd };
}

describe("optidevStartup", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("starts a project natively with advice-enabled bootstrap, layout, and local session state", async () => {
    const repoRoot = makeTempDir("optidev-startup-root-");
    const homeDir = makeTempDir("optidev-startup-home-");
    const projectPath = path.join(homeDir, "projects", "demo");
    const context = makeContext(homeDir, repoRoot);

    fs.mkdirSync(path.join(projectPath, ".project"), { recursive: true });
    fs.mkdirSync(path.join(projectPath, ".agents", "agents"), { recursive: true });
    fs.writeFileSync(path.join(projectPath, ".project", "config.yaml"), JSON.stringify({ dev: { start: [] }, tests: { command: "pytest", watch: [] }, logs: { sources: [] } }, null, 2), "utf8");
    fs.writeFileSync(path.join(projectPath, ".agents", "agents", "reviewer.md"), "# reviewer\n", "utf8");
    fs.writeFileSync(path.join(homeDir, "config.yaml"), "mux_backend: textual\ndefault_runner: claude\n", "utf8");

    const result = await nativeStartAction(context, projectPath, undefined, {
      now: () => "2026-03-08T12:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(result.lines).toContain("OptiDev workspace ready.");
    expect(result.lines.join("\n")).toContain("Runtime mode: bootstrap.");
    expect(result.lines.join("\n")).toContain("Runner ready: claude.");
    expect(result.lines.join("\n")).toContain("Advice mode: startup repo analysis prompt queued for the runner.");
    expect(result.lines.join("\n")).toContain("Open /optidev in the forked t3 UI.");
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo", "runner.json"))).toBe(true);
    expect(fs.readFileSync(path.join(homeDir, "sessions", "demo", "runner.json"), "utf8")).toContain('"runner": "claude"');
    const sessionState = JSON.parse(fs.readFileSync(path.join(homeDir, "sessions", "demo", "session.json"), "utf8")) as { mux_backend: string; layout_path: string };
    expect(sessionState.mux_backend).toBe("textual");
    expect(fs.existsSync(sessionState.layout_path)).toBe(true);
    const layout = JSON.parse(fs.readFileSync(sessionState.layout_path, "utf8")) as {
      layout: {
        tabs: Array<{
          root?: {
            command?: string[];
          };
        }>;
      };
    };
    expect(JSON.stringify(layout)).not.toContain("python3");
    expect(JSON.stringify(layout)).not.toContain("optidev.chat_bridge");
    expect(JSON.stringify(layout)).not.toContain("optidev.pane_runtime");
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo", "startup-prompt.txt"))).toBe(true);
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo", "optid-context.md"))).toBe(true);
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo", "chat-pane.sh"))).toBe(true);
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo", "editor-pane.sh"))).toBe(true);
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo", "logs-pane.sh"))).toBe(true);
    expect(fs.existsSync(path.join(homeDir, "sessions", "demo", "tests-pane.sh"))).toBe(true);
    expect(fs.readFileSync(path.join(projectPath, ".optidev", "session.json"), "utf8")).toContain('"last_mode": "bootstrap"');
  });

  it("resumes only when the project session is compatible", async () => {
    const repoRoot = makeTempDir("optidev-startup-root-");
    const homeDir = makeTempDir("optidev-startup-home-");
    const projectPath = path.join(homeDir, "projects", "demo");
    const context = makeContext(homeDir, repoRoot);

    fs.mkdirSync(path.join(projectPath, ".project"), { recursive: true });
    fs.writeFileSync(path.join(projectPath, ".project", "config.yaml"), JSON.stringify({ dev: { start: [] }, tests: { command: null, watch: [] }, logs: { sources: [] } }, null, 2), "utf8");
    fs.writeFileSync(path.join(homeDir, "config.yaml"), "mux_backend: textual\n", "utf8");

    const missing = await nativeResumeAction(context, projectPath);
    expect(missing.ok).toBe(false);
    expect(missing.lines).toEqual(["No compatible workspace session to resume."]);

    const started = await nativeStartAction(context, projectPath);
    expect(started.ok).toBe(true);

    const resumed = await nativeResumeAction(context, projectPath);
    expect(resumed.ok).toBe(true);
    expect(resumed.lines.join("\n")).toContain("Session restored.");
    expect(resumed.lines.join("\n")).not.toContain("Advice mode was requested");
  });

  it("go initializes and starts through the native TS path", async () => {
    const repoRoot = makeTempDir("optidev-startup-root-");
    const homeDir = makeTempDir("optidev-startup-home-");
    const context = makeContext(homeDir, repoRoot);

    fs.writeFileSync(path.join(homeDir, "config.yaml"), "mux_backend: textual\n", "utf8");

    const result = await nativeGoAction(context, "demo", repoRoot);

    expect(result.ok).toBe(true);
    expect(result.lines.join("\n")).toContain("Initialized project 'demo'");
    expect(result.lines.join("\n")).toContain("OptiDev workspace ready.");
    expect(fs.existsSync(path.join(repoRoot, "demo", ".project", "config.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "demo", ".optidev", "session.json"))).toBe(true);
    expect(result.lines.join("\n")).toContain("Advice mode: startup repo analysis prompt queued for the runner.");
  });

  it("supports opting out of default advice", async () => {
    const repoRoot = makeTempDir("optidev-startup-root-");
    const homeDir = makeTempDir("optidev-startup-home-");
    const projectPath = path.join(homeDir, "projects", "demo");
    const context = makeContext(homeDir, repoRoot);

    fs.mkdirSync(path.join(projectPath, ".project"), { recursive: true });
    fs.writeFileSync(
      path.join(projectPath, ".project", "config.yaml"),
      JSON.stringify({ dev: { start: [] }, tests: { command: null, watch: [] }, logs: { sources: [] } }, null, 2),
      "utf8",
    );
    fs.writeFileSync(path.join(homeDir, "config.yaml"), "mux_backend: textual\ndefault_runner: claude\n", "utf8");

    const result = await nativeStartAction(context, projectPath, false);

    expect(result.ok).toBe(true);
    expect(result.lines.join("\n")).not.toContain("Advice mode: startup repo analysis prompt queued for the runner.");
  });
});
