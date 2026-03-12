import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OptiDevRouteContext } from "./optidevContract";
import {
  buildNativeRepoAdvice,
  nativePluginAction,
  recordNativeWorkspaceStarted,
  recordNativeWorkspaceStopped,
} from "./optidevPlugins";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeContext(homeDir: string, cwd: string): OptiDevRouteContext {
  return { homeDir, cwd };
}

describe("optidevPlugins", () => {
  const originalSkillsNpx = process.env.OPTIDEV_SKILLS_NPX;
  const originalAgentsBaseUrl = process.env.OPTIDEV_AGENTS_BASE_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
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
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders native repo advice summary", async () => {
    const projectDir = makeTempDir("optidev-plugins-project-");
    fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ dependencies: { react: "1.0.0", next: "1.0.0" } }), "utf8");
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "src", "main.ts"), "console.log('hi')\n", "utf8");

    const advice = await buildNativeRepoAdvice(projectDir);

    expect(advice.repo_summary).toContain("react");
    expect(advice.repo_summary).toContain("nextjs");
    expect(advice.initial_prompt).toContain("optid skills search");
  });

  it("handles native advice and telegram plugin commands", async () => {
    const homeDir = makeTempDir("optidev-plugins-home-");
    const projectDir = makeTempDir("optidev-plugins-project-");
    const context = makeContext(homeDir, projectDir);

    fs.writeFileSync(path.join(homeDir, "config.yaml"), '{"telegram_bot_token":"123456:ABCDEF","telegram_chat_id":55}', "utf8");

    const advice = await nativePluginAction(context, "advice", [], projectDir);
    const telegramStart = await nativePluginAction(context, "telegram", ["start"], projectDir);
    const telegramStatus = await nativePluginAction(context, "telegram", ["status"], projectDir);
    const telegramStop = await nativePluginAction(context, "telegram", ["stop"], projectDir);

    expect(advice.ok).toBe(true);
    expect(advice.lines[0]).toContain(`- root: ${projectDir}`);
    expect(telegramStart.ok).toBe(true);
    expect(telegramStart.lines[0]).toContain("Telegram bridge enabled");
    expect(telegramStatus.ok).toBe(true);
    expect(telegramStatus.lines[0]).toContain("enabled for chat 55");
    expect(telegramStop.ok).toBe(true);
    expect(telegramStop.lines[0]).toContain("Telegram bridge disabled");
  });

  it("records native telegram workspace lifecycle events", async () => {
    const homeDir = makeTempDir("optidev-plugins-home-");
    const projectDir = makeTempDir("optidev-plugins-project-");
    const context = makeContext(homeDir, projectDir);

    await recordNativeWorkspaceStarted(context, { project: "demo", status: "running" });
    await recordNativeWorkspaceStopped(context, { project: "demo", status: "running" });

    const content = fs.readFileSync(path.join(homeDir, "plugins", "telegram-events.jsonl"), "utf8");
    expect(content).toContain("workspace_start");
    expect(content).toContain("workspace_stop");
  });

  it("handles native skills search and install commands", async () => {
    const homeDir = makeTempDir("optidev-plugins-home-");
    const projectDir = makeTempDir("optidev-plugins-project-");
    const context = makeContext(homeDir, projectDir);
    const fakeBin = path.join(makeTempDir("optidev-plugins-bin-"), "npx");

    fs.writeFileSync(
      fakeBin,
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
    fs.chmodSync(fakeBin, 0o755);
    process.env.OPTIDEV_SKILLS_NPX = fakeBin;

    const search = await nativePluginAction(context, "skills", ["search", "demo"], projectDir);
    const install = await nativePluginAction(context, "skills", ["install", "owner/repo@demo-skill"], projectDir);

    expect(search.ok).toBe(true);
    expect(search.lines).toContain("demo-skill");
    expect(install.ok).toBe(true);
    expect(install.lines[0]).toContain("Installed skill:");
    expect(fs.existsSync(path.join(projectDir, ".agents", "skills", "demo-skill", "SKILL.md"))).toBe(true);
  });

  it("handles native agents search and install commands", async () => {
    const homeDir = makeTempDir("optidev-plugins-home-");
    const projectDir = makeTempDir("optidev-plugins-project-");
    const context = makeContext(homeDir, projectDir);

    const server = http.createServer((req, res) => {
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
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    try {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        throw new Error("Expected http server address");
      }
      process.env.OPTIDEV_AGENTS_BASE_URL = `http://127.0.0.1:${address.port}`;

      const search = await nativePluginAction(context, "agents", ["search", "code"], projectDir);
      const install = await nativePluginAction(context, "agents", ["install", "codegpt"], projectDir);

      expect(search.ok).toBe(true);
      expect(search.lines[0]).toContain("codegpt - CodeGPT");
      expect(install.ok).toBe(true);
      expect(install.lines[0]).toContain("Installed agent:");
      expect(fs.existsSync(path.join(projectDir, ".agents", "agents", "codegpt.md"))).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => (error ? reject(error) : resolve())));
    }
  });
});
