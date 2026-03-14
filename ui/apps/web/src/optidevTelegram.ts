export interface OptiDevTelegramBridgeStatus {
  enabled: boolean;
  chatId: string;
  tokenHint: string;
  targetThreadId: string | null;
  targetUpdatedAt: string | null;
  statusLine: string;
}

export interface OptiDevTelegramConfigPayload {
  botToken: string;
  chatId: string;
  bridge?: OptiDevTelegramBridgeStatus;
}

interface ErrorEnvelope {
  ok?: boolean;
  lines?: string[];
}

async function readJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json()) as ErrorEnvelope & T;
  if (!response.ok || body.ok === false) {
    throw new Error(body.lines?.join("\n") || `Request failed: ${response.status}`);
  }
  return body;
}

export async function fetchTelegramConfig(): Promise<OptiDevTelegramConfigPayload> {
  const body = await readJson<{ data: OptiDevTelegramConfigPayload }>("/api/optidev/telegram-config");
  return body.data;
}

export async function saveTelegramConfig(payload: {
  botToken: string;
  chatId: string;
}): Promise<{ lines: string[]; data: OptiDevTelegramConfigPayload }> {
  return readJson<{ lines: string[]; data: OptiDevTelegramConfigPayload }>("/api/optidev/telegram-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function runTelegramBridgeAction(input: {
  enabled: boolean;
  threadId?: string | null;
}): Promise<{ lines: string[] }> {
  const args = input.enabled ? ["start"] : ["stop"];
  return readJson<{ lines: string[] }>("/api/optidev/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "plugin",
      command: "telegram",
      args,
      threadId: input.enabled ? input.threadId ?? undefined : undefined,
    }),
  });
}
