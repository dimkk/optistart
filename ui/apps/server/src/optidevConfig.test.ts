import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readTelegramConfig, writeTelegramConfig } from "./optidevConfig";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("optidevConfig", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads and writes Telegram settings in the OptiDev home config", async () => {
    const homeDir = makeTempDir("optidev-config-home-");

    const saved = await writeTelegramConfig(
      { cwd: "/repo", homeDir },
      {
        botToken: "token-123",
        chatId: "123456",
      },
    );
    const readBack = await readTelegramConfig({ cwd: "/repo", homeDir });

    expect(saved).toEqual({ botToken: "token-123", chatId: "123456" });
    expect(readBack).toEqual({ botToken: "token-123", chatId: "123456" });
    expect(fs.readFileSync(path.join(homeDir, "config.yaml"), "utf8")).toContain("telegram_bot_token");
  });
});
