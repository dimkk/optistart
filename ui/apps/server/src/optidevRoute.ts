import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  type OptiDevActionPayload,
  type OptiDevActionResponse,
  type OptiDevRouteContext,
  resolveOptiDevProjectRoot,
} from "./optidevContract";
import {
  buildNativeState,
  nativeLogsAction,
  nativeProjectsAction,
  discoverProjectsNative,
  nativeStatusAction,
  supportsNativeReadOnlyAction,
} from "./optidevNative";
import {
  nativeMemoryOpenLoops,
  nativeMemoryShow,
  nativeMemorySummary,
  buildMemoryGraphPayload,
} from "./optidevMemory";
import {
  nativeInitAction,
  nativeWorkspaceCloneAction,
} from "./optidevPersistence";
import { nativeResetAction, nativeStopAction } from "./optidevLifecycle";
import {
  nativeGoAction,
  nativeResumeAction,
  nativeStartAction,
} from "./optidevStartup";
import {
  nativePluginAction,
  readNativePluginInventory,
  readTelegramBridgeStatus,
  supportsNativePluginCommand,
} from "./optidevPlugins";
import {
  listScopedDirectory,
  readScopedFile,
  readScopedRawFile,
  writeScopedTextFile,
} from "./optidevFiles";
import { readTelegramConfig, writeTelegramConfig } from "./optidevConfig";
import { nativeBuildInfoAction } from "./optidevBuildInfo";
import {
  describeOptiDevManifestRuntime,
  previewOptiDevManifestImpact,
  saveOptiDevManifest,
} from "./optidevManifest";

export type { OptiDevActionPayload, OptiDevActionResponse } from "./optidevContract";
export { resolveOptiDevProjectRoot } from "./optidevContract";

function json(res: ServerResponse, statusCode: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(body);
}

function sendRaw(
  res: ServerResponse,
  statusCode: number,
  contentType: string,
  body: Buffer,
) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": String(body.byteLength),
  });
  res.end(body);
}

function toErrorResponse(error: unknown, fallback = "OptiDev action failed."): OptiDevActionResponse {
  if (error instanceof Error && error.message.trim().length > 0) {
    return { ok: false, lines: [error.message.trim()] };
  }
  return { ok: false, lines: [fallback] };
}

function normalizePayload(payload: OptiDevActionPayload, context: OptiDevRouteContext): OptiDevActionPayload {
  return {
    ...payload,
    cwd: payload.cwd ?? resolveOptiDevProjectRoot(context.cwd),
  };
}

function resolveAdviceFlag(payload: OptiDevActionPayload): boolean {
  return payload.advice === undefined ? true : Boolean(payload.advice);
}

async function resolveActionCwd(
  context: OptiDevRouteContext,
  payload: OptiDevActionPayload,
): Promise<string> {
  const target = (payload.target ?? ".").trim() || ".";
  if (payload.cwd) {
    return payload.cwd;
  }
  if (target !== ".") {
    const projects = await discoverProjectsNative(context);
    const project = projects.find((item) => item.name === target);
    if (project) {
      return project.path;
    }
  }
  return resolveOptiDevProjectRoot(context.cwd);
}

async function runOptiDevAction(
  action: string,
  payload: OptiDevActionPayload,
  context: OptiDevRouteContext,
  extraActionHandler?: (
    action: string,
    payload: OptiDevActionPayload,
    context: OptiDevRouteContext,
  ) => Promise<OptiDevActionResponse | null>,
): Promise<OptiDevActionResponse> {
  const normalizedPayload = normalizePayload(payload, context);

  if (action === "state") {
    try {
      return await buildNativeState(context, () => nativeMemorySummary(normalizedPayload.cwd ?? context.cwd));
    } catch (error) {
      return toErrorResponse(error, "Failed to build OptiDev state.");
    }
  }

  if (action === "memory_summary") {
    try {
      return await nativeMemorySummary(await resolveActionCwd(context, payload));
    } catch (error) {
      return toErrorResponse(error, "Failed to read OptiDev memory summary.");
    }
  }

  if (action === "memory_open_loops") {
    try {
      return await nativeMemoryOpenLoops(await resolveActionCwd(context, payload));
    } catch (error) {
      return toErrorResponse(error, "Failed to read OptiDev open loops.");
    }
  }

  if (action === "memory_show") {
    try {
      return await nativeMemoryShow(
        await resolveActionCwd(context, payload),
        normalizedPayload.kind ?? "",
        normalizedPayload.identifier ?? "",
      );
    } catch (error) {
      return toErrorResponse(error, "Failed to read OptiDev memory entry.");
    }
  }

  if (action === "build_info") {
    try {
      return await nativeBuildInfoAction(context);
    } catch (error) {
      return toErrorResponse(error, "Failed to resolve OptiDev build information.");
    }
  }

  if (action === "init") {
    try {
      return await nativeInitAction(
        context,
        normalizedPayload.target ?? ".",
        await resolveActionCwd(context, payload),
      );
    } catch (error) {
      return toErrorResponse(error, "Failed to initialize OptiDev project.");
    }
  }

  if (action === "workspace_clone") {
    try {
      return await nativeWorkspaceCloneAction(
        context,
        normalizedPayload.name ?? "",
        await resolveActionCwd(context, payload),
      );
    } catch (error) {
      return toErrorResponse(error, "Failed to clone OptiDev workspace.");
    }
  }

  if (action === "reset") {
    try {
      return await nativeResetAction(
        context,
        await resolveActionCwd(context, payload),
      );
    } catch (error) {
      return toErrorResponse(error, "Failed to reset OptiDev workspace.");
    }
  }

  if (action === "start") {
    try {
      return await nativeStartAction(
        context,
        await resolveActionCwd(context, payload),
        resolveAdviceFlag(normalizedPayload),
      );
    } catch (error) {
      return toErrorResponse(error, "Failed to start OptiDev workspace.");
    }
  }

  if (action === "resume") {
    try {
      return await nativeResumeAction(
        context,
        await resolveActionCwd(context, payload),
      );
    } catch (error) {
      return toErrorResponse(error, "Failed to resume OptiDev workspace.");
    }
  }

  if (action === "go") {
    try {
      return await nativeGoAction(
        context,
        normalizedPayload.target ?? ".",
        normalizedPayload.cwd ?? resolveOptiDevProjectRoot(context.cwd),
        resolveAdviceFlag(normalizedPayload),
      );
    } catch (error) {
      return toErrorResponse(error, "Failed to bootstrap OptiDev workspace.");
    }
  }

  if (action === "stop") {
    try {
      return await nativeStopAction(context);
    } catch (error) {
      return toErrorResponse(error, "Failed to stop OptiDev workspace.");
    }
  }

  if (action === "plugin") {
    const command = (normalizedPayload.command ?? "").trim();
    const args = (normalizedPayload.args ?? []).map((item) => String(item));
    if (!supportsNativePluginCommand(command, args)) {
      return {
        ok: false,
        lines: [command ? `Unsupported plugin command: ${command}.` : "Plugin command is required."],
      };
    }
    try {
      return await nativePluginAction(
        context,
        command,
        args,
        await resolveActionCwd(context, payload),
        normalizedPayload,
      );
    } catch (error) {
      return toErrorResponse(error, "Failed to run OptiDev plugin action.");
    }
  }

  if (supportsNativeReadOnlyAction(action)) {
    try {
      if (action === "status") {
        return await nativeStatusAction(context);
      }
      if (action === "logs") {
        return await nativeLogsAction(context);
      }
      return await nativeProjectsAction(context);
    } catch (error) {
      return toErrorResponse(error, `Failed to run OptiDev action: ${action}.`);
    }
  }

  if (extraActionHandler) {
    const extra = await extraActionHandler(action, payload, context);
    if (extra) {
      return extra;
    }
  }

  return {
    ok: false,
    lines: [`Unsupported OptiDev action: ${action}.`],
  };
}

export async function tryHandleOptiDevRequest(
  req: IncomingMessage,
  url: URL,
  reqBody: string,
  res: ServerResponse,
  context: OptiDevRouteContext,
  extraActionHandler?: (
    action: string,
    payload: OptiDevActionPayload,
    context: OptiDevRouteContext,
  ) => Promise<OptiDevActionResponse | null>,
): Promise<boolean> {
  const method = (req.method ?? "GET").toUpperCase();

  if (url.pathname === "/api/optidev/health") {
    json(res, 200, {
      ok: true,
      root: resolveOptiDevProjectRoot(context.cwd),
    });
    return true;
  }

  if (url.pathname === "/api/optidev/state") {
    const result = await runOptiDevAction("state", {}, context);
    json(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (url.pathname === "/api/optidev/manifest" && method === "GET") {
    try {
      const projectRoot = resolveOptiDevProjectRoot(context.cwd);
      json(res, 200, {
        ok: true,
        data: await describeOptiDevManifestRuntime(projectRoot, context),
      });
    } catch (error) {
      json(res, 400, toErrorResponse(error, "Failed to read OptiDev manifest."));
    }
    return true;
  }

  if (url.pathname === "/api/optidev/manifest" && method === "POST") {
    let payload: OptiDevActionPayload;
    try {
      payload = reqBody.trim().length > 0 ? (JSON.parse(reqBody) as OptiDevActionPayload) : {};
    } catch {
      json(res, 400, { ok: false, lines: ["Invalid JSON body."] });
      return true;
    }
    try {
      const projectRoot = resolveOptiDevProjectRoot(context.cwd);
      const saved = await saveOptiDevManifest(projectRoot, context, String(payload.content ?? ""));
      json(res, 200, {
        ok: true,
        lines: saved.lines,
        data: saved.payload,
      });
    } catch (error) {
      json(res, 400, toErrorResponse(error, "Failed to save OptiDev manifest."));
    }
    return true;
  }

  if (url.pathname === "/api/optidev/manifest/impact" && method === "POST") {
    let payload: OptiDevActionPayload;
    try {
      payload = reqBody.trim().length > 0 ? (JSON.parse(reqBody) as OptiDevActionPayload) : {};
    } catch {
      json(res, 400, { ok: false, lines: ["Invalid JSON body."] });
      return true;
    }
    try {
      const projectRoot = resolveOptiDevProjectRoot(context.cwd);
      json(res, 200, {
        ok: true,
        data: await previewOptiDevManifestImpact(projectRoot, context, String(payload.content ?? "")),
      });
    } catch (error) {
      json(res, 400, toErrorResponse(error, "Failed to preview OptiDev manifest impact."));
    }
    return true;
  }

  if (url.pathname === "/api/optidev/memory-graph" && method === "GET") {
    try {
      const projectRoot = resolveOptiDevProjectRoot(context.cwd);
      json(res, 200, {
        ok: true,
        data: await buildMemoryGraphPayload(projectRoot),
      });
    } catch (error) {
      json(res, 400, toErrorResponse(error, "Failed to build OptiDev memory graph."));
    }
    return true;
  }

  if (url.pathname === "/api/optidev/plugins" && method === "GET") {
    try {
      const projectRoot = resolveOptiDevProjectRoot(context.cwd);
      json(res, 200, {
        ok: true,
        data: await readNativePluginInventory(context, projectRoot),
      });
    } catch (error) {
      json(res, 400, toErrorResponse(error, "Failed to read OptiDev plugin inventory."));
    }
    return true;
  }

  if (url.pathname === "/api/optidev/fs/list") {
    try {
      const scope = (url.searchParams.get("scope") ?? "repo") as OptiDevActionPayload["scope"];
      const relativePath = url.searchParams.get("path") ?? "";
      if (scope !== "repo" && scope !== "agents" && scope !== "skills") {
        json(res, 400, { ok: false, lines: ["Unsupported file scope."] });
        return true;
      }
      const data = await listScopedDirectory(context, scope, relativePath);
      json(res, 200, { ok: true, lines: [], data });
    } catch (error) {
      json(res, 400, toErrorResponse(error, "Failed to list OptiDev files."));
    }
    return true;
  }

  if (url.pathname === "/api/optidev/fs/read") {
    try {
      const scope = (url.searchParams.get("scope") ?? "repo") as OptiDevActionPayload["scope"];
      const relativePath = url.searchParams.get("path") ?? "";
      if (scope !== "repo" && scope !== "agents" && scope !== "skills") {
        json(res, 400, { ok: false, lines: ["Unsupported file scope."] });
        return true;
      }
      const data = await readScopedFile(context, scope, relativePath);
      json(res, 200, { ok: true, lines: [], data });
    } catch (error) {
      json(res, 400, toErrorResponse(error, "Failed to read OptiDev file."));
    }
    return true;
  }

  if (url.pathname === "/api/optidev/fs/raw") {
    try {
      const scope = (url.searchParams.get("scope") ?? "repo") as OptiDevActionPayload["scope"];
      const relativePath = url.searchParams.get("path") ?? "";
      if (scope !== "repo" && scope !== "agents" && scope !== "skills") {
        json(res, 400, { ok: false, lines: ["Unsupported file scope."] });
        return true;
      }
      const raw = await readScopedRawFile(context, scope, relativePath);
      const body = await fs.readFile(raw.filePath);
      sendRaw(res, 200, raw.contentType, body);
    } catch (error) {
      json(res, 400, toErrorResponse(error, "Failed to stream OptiDev file."));
    }
    return true;
  }

  if (url.pathname === "/api/optidev/fs/write") {
    if (method !== "POST" && method !== "PUT") {
      json(res, 405, { ok: false, lines: ["Method not allowed."] });
      return true;
    }
    let payload: OptiDevActionPayload = {};
    if (reqBody.trim().length > 0) {
      try {
        payload = JSON.parse(reqBody) as OptiDevActionPayload;
      } catch {
        json(res, 400, { ok: false, lines: ["Invalid JSON body."] });
        return true;
      }
    }
    const scope = payload.scope;
    if (scope !== "agents" && scope !== "skills") {
      json(res, 400, { ok: false, lines: ["Only agent and skill files are editable."] });
      return true;
    }
    try {
      const data = await writeScopedTextFile(context, scope, payload.path ?? "", payload.content ?? "");
      json(res, 200, { ok: true, lines: [`Saved ${data.path}.`], data });
    } catch (error) {
      json(res, 400, toErrorResponse(error, "Failed to save OptiDev file."));
    }
    return true;
  }

  if (url.pathname === "/api/optidev/telegram-config") {
    if (method === "GET") {
      try {
        const data = await readTelegramConfig(context);
        const bridge = await readTelegramBridgeStatus(context);
        json(res, 200, { ok: true, lines: [], data: { ...data, bridge } });
      } catch (error) {
        json(res, 400, toErrorResponse(error, "Failed to read Telegram config."));
      }
      return true;
    }

    if (method !== "POST" && method !== "PUT") {
      json(res, 405, { ok: false, lines: ["Method not allowed."] });
      return true;
    }

    let payload: OptiDevActionPayload = {};
    if (reqBody.trim().length > 0) {
      try {
        payload = JSON.parse(reqBody) as OptiDevActionPayload;
      } catch {
        json(res, 400, { ok: false, lines: ["Invalid JSON body."] });
        return true;
      }
    }

    try {
      const data = await writeTelegramConfig(context, {
        botToken: String(payload.botToken ?? ""),
        chatId: String(payload.chatId ?? ""),
      });
      const bridge = await readTelegramBridgeStatus(context);
      json(res, 200, { ok: true, lines: ["Telegram settings saved."], data: { ...data, bridge } });
    } catch (error) {
      json(res, 400, toErrorResponse(error, "Failed to save Telegram config."));
    }
    return true;
  }

  if (url.pathname !== "/api/optidev/action") {
    return false;
  }

  let payload: OptiDevActionPayload = {};
  if (reqBody.trim().length > 0) {
    try {
      payload = JSON.parse(reqBody) as OptiDevActionPayload;
    } catch {
      json(res, 400, { ok: false, lines: ["Invalid JSON body."] });
      return true;
    }
  }

  const action = (payload.action ?? "").trim();
  if (!action) {
    json(res, 400, { ok: false, lines: ["OptiDev action is required."] });
    return true;
  }

  const result = await runOptiDevAction(action, payload, context, extraActionHandler);
  json(res, result.ok ? 200 : 400, result);
  return true;
}
