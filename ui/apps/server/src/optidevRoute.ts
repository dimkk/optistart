import type { ServerResponse } from "node:http";

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
import { nativePluginAction, supportsNativePluginCommand } from "./optidevPlugins";

export type { OptiDevActionPayload, OptiDevActionResponse } from "./optidevContract";
export { resolveOptiDevProjectRoot } from "./optidevContract";

function json(res: ServerResponse, statusCode: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
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
        Boolean(normalizedPayload.advice),
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
        Boolean(normalizedPayload.advice),
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

  return {
    ok: false,
    lines: [`Unsupported OptiDev action: ${action}.`],
  };
}

export async function tryHandleOptiDevRequest(
  url: URL,
  reqBody: string,
  res: ServerResponse,
  context: OptiDevRouteContext,
): Promise<boolean> {
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

  const result = await runOptiDevAction(action, payload, context);
  json(res, result.ok ? 200 : 400, result);
  return true;
}
