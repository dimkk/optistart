import path from "node:path";

import type { OptiDevRouteContext } from "./optidevContract";
import { nativeResetAction, nativeStopAction } from "./optidevLifecycle";
import {
  nativeMemoryOpenLoops,
  nativeMemoryShow,
  nativeMemorySummary,
} from "./optidevMemory";
import {
  discoverProjectsNative,
  nativeLogsAction,
  nativeProjectsAction,
  nativeStatusAction,
} from "./optidevNative";
import { nativeInitAction, nativeWorkspaceCloneAction } from "./optidevPersistence";
import { nativePluginAction, supportsNativePluginCommand } from "./optidevPlugins";
import {
  nativeGoAction,
  nativeResumeAction,
  nativeStartAction,
} from "./optidevStartup";
import { nativeRunnerListAction, nativeRunnerResumeAction } from "./optidevRunner";

const USAGE =
  "Usage: optid start [project|.] [--advice] | " +
  "optid [init <name|.>|go <name|.> [--advice]|resume [project|.]|reset [project|.]|" +
  "workspace clone <name>|memory [show <kind> <id>|open-loops]|runner <ls|resume <id>>|stop|status|logs|projects|" +
  "telegram|skills|agents|advice]";

interface CliStreams {
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
}

interface CliRuntime {
  cwd: string;
  env: NodeJS.ProcessEnv;
  streams: CliStreams;
}

function makeContext(runtime: CliRuntime): OptiDevRouteContext {
  return {
    cwd: runtime.cwd,
    homeDir: runtime.env.OPTIDEV_HOME?.trim() || undefined,
  };
}

function printLines(
  lines: string[],
  stream: { write(chunk: string): void },
): void {
  for (const line of lines) {
    stream.write(`${line}\n`);
  }
}

function printText(
  text: string,
  stream: { write(chunk: string): void },
): void {
  stream.write(`${text}\n`);
}

function parseTargetAndAdvice(
  args: string[],
  defaultTarget: string | null,
): { target: string | null; advice: boolean } | null {
  let target = defaultTarget;
  let advice = false;
  for (const arg of args) {
    if (arg === "--advice") {
      advice = true;
      continue;
    }
    if (target === null) {
      target = arg;
      continue;
    }
    if (defaultTarget === "." && target === ".") {
      target = arg;
      continue;
    }
    return null;
  }
  return { target, advice };
}

async function resolveProjectDir(
  context: OptiDevRouteContext,
  cwd: string,
  target: string,
): Promise<string> {
  const normalized = target.trim() || ".";
  if (normalized === ".") {
    return path.resolve(cwd);
  }
  const projects = await discoverProjectsNative(context);
  const matched = projects.find((item) => item.name === normalized);
  if (matched) {
    return matched.path;
  }
  return path.resolve(cwd, normalized);
}

export async function runOptiDevCli(
  argv: string[],
  runtime: Partial<CliRuntime> = {},
): Promise<number> {
  const effectiveRuntime: CliRuntime = {
    cwd: runtime.cwd ?? process.cwd(),
    env: runtime.env ?? process.env,
    streams: runtime.streams ?? {
      stdout: process.stdout,
      stderr: process.stderr,
    },
  };
  const context = makeContext(effectiveRuntime);
  const [command, ...rest] = argv;

  if (!command) {
    printText(USAGE, effectiveRuntime.streams.stderr);
    return 2;
  }

  if (command === "start") {
    const parsed = parseTargetAndAdvice(rest, ".");
    if (!parsed?.target) {
      printText(USAGE, effectiveRuntime.streams.stderr);
      return 2;
    }
    const result = await nativeStartAction(
      context,
      await resolveProjectDir(context, effectiveRuntime.cwd, parsed.target),
      parsed.advice,
    );
    printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
    return result.ok ? 0 : 1;
  }

  if (command === "resume") {
    const target = rest[0] ?? ".";
    const result = await nativeResumeAction(
      context,
      await resolveProjectDir(context, effectiveRuntime.cwd, target),
    );
    printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
    return result.ok ? 0 : 1;
  }

  if (command === "reset") {
    const target = rest[0] ?? ".";
    const result = await nativeResetAction(
      context,
      await resolveProjectDir(context, effectiveRuntime.cwd, target),
    );
    printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
    return result.ok ? 0 : 1;
  }

  if (command === "stop") {
    const result = await nativeStopAction(context);
    printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
    return result.ok ? 0 : 1;
  }

  if (command === "init") {
    if (rest.length < 1) {
      printText(USAGE, effectiveRuntime.streams.stderr);
      return 2;
    }
    const result = await nativeInitAction(context, rest[0]!, effectiveRuntime.cwd);
    printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
    return result.ok ? 0 : 1;
  }

  if (command === "go") {
    const parsed = parseTargetAndAdvice(rest, null);
    if (!parsed?.target) {
      printText(USAGE, effectiveRuntime.streams.stderr);
      return 2;
    }
    const result = await nativeGoAction(context, parsed.target, effectiveRuntime.cwd, parsed.advice);
    printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
    return result.ok ? 0 : 1;
  }

  if (command === "status") {
    const result = await nativeStatusAction(context);
    printLines(result.lines, effectiveRuntime.streams.stdout);
    return result.ok ? 0 : 1;
  }

  if (command === "logs") {
    const result = await nativeLogsAction(context);
    printLines(result.lines, effectiveRuntime.streams.stdout);
    return result.ok ? 0 : 1;
  }

  if (command === "projects") {
    const result = await nativeProjectsAction(context);
    printLines(result.lines, effectiveRuntime.streams.stdout);
    return result.ok ? 0 : 1;
  }

  if (command === "workspace") {
    if (rest.length === 2 && rest[0] === "clone") {
      const result = await nativeWorkspaceCloneAction(context, rest[1]!, effectiveRuntime.cwd);
      printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
      return result.ok ? 0 : 1;
    }
    printText(USAGE, effectiveRuntime.streams.stderr);
    return 2;
  }

  if (command === "memory") {
    if (rest.length === 0) {
      const result = await nativeMemorySummary(path.resolve(effectiveRuntime.cwd));
      printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
      return result.ok ? 0 : 1;
    }
    if (rest.length === 1 && rest[0] === "open-loops") {
      const result = await nativeMemoryOpenLoops(path.resolve(effectiveRuntime.cwd));
      printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
      return result.ok ? 0 : 1;
    }
    if (rest.length === 3 && rest[0] === "show") {
      const result = await nativeMemoryShow(path.resolve(effectiveRuntime.cwd), rest[1]!, rest[2]!);
      printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
      return result.ok ? 0 : 1;
    }
    printText(USAGE, effectiveRuntime.streams.stderr);
    return 2;
  }

  if (command === "runner") {
    if (rest.length === 1 && rest[0] === "ls") {
      const result = await nativeRunnerListAction(context, effectiveRuntime.env);
      printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
      return result.ok ? 0 : 1;
    }
    if (rest.length === 2 && rest[0] === "resume") {
      const result = await nativeRunnerResumeAction(context, rest[1]!, effectiveRuntime.env);
      printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
      return result.ok ? 0 : 1;
    }
    printText(USAGE, effectiveRuntime.streams.stderr);
    return 2;
  }

  if (supportsNativePluginCommand(command, rest)) {
    const result = await nativePluginAction(
      context,
      command,
      rest,
      path.resolve(effectiveRuntime.cwd),
    );
    printLines(result.lines, result.ok ? effectiveRuntime.streams.stdout : effectiveRuntime.streams.stderr);
    return result.ok ? 0 : 1;
  }

  if (command.startsWith("-")) {
    printText(USAGE, effectiveRuntime.streams.stderr);
    return 2;
  }

  printText(USAGE, effectiveRuntime.streams.stderr);
  return 2;
}

if (import.meta.main) {
  runOptiDevCli(process.argv.slice(2))
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
