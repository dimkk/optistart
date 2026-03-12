import fs from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import type {
  OptiDevRouteContext,
  OptiDevTelegramConfigPayload,
} from "./optidevContract";
import { resolveHomeDir } from "./optidevNative";

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

async function readConfigMapping(configPath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = YAML.parse(raw);
    return asObject(parsed) ?? {};
  } catch {
    return {};
  }
}

export async function readTelegramConfig(
  context: OptiDevRouteContext,
): Promise<OptiDevTelegramConfigPayload> {
  const homeDir = resolveHomeDir(context);
  const configPath = path.join(homeDir, "config.yaml");
  const parsed = await readConfigMapping(configPath);
  return {
    botToken: typeof parsed.telegram_bot_token === "string" ? parsed.telegram_bot_token : "",
    chatId:
      typeof parsed.telegram_chat_id === "number"
        ? String(parsed.telegram_chat_id)
        : typeof parsed.telegram_chat_id === "string"
          ? parsed.telegram_chat_id
          : "",
  };
}

export async function writeTelegramConfig(
  context: OptiDevRouteContext,
  nextConfig: OptiDevTelegramConfigPayload,
): Promise<OptiDevTelegramConfigPayload> {
  const homeDir = resolveHomeDir(context);
  const configPath = path.join(homeDir, "config.yaml");
  await fs.mkdir(homeDir, { recursive: true });
  const parsed = await readConfigMapping(configPath);

  parsed.telegram_bot_token = nextConfig.botToken.trim();
  const trimmedChatId = nextConfig.chatId.trim();
  if (trimmedChatId.length === 0) {
    delete parsed.telegram_chat_id;
  } else if (/^-?\d+$/.test(trimmedChatId)) {
    parsed.telegram_chat_id = Number(trimmedChatId);
  } else {
    parsed.telegram_chat_id = trimmedChatId;
  }

  await fs.writeFile(configPath, YAML.stringify(parsed), "utf8");
  return readTelegramConfig(context);
}
