import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BotIcon,
  BookMarkedIcon,
  ChevronRightIcon,
  FileCode2Icon,
  FileIcon,
  FileImageIcon,
  FolderIcon,
  FolderOpenIcon,
  RefreshCwIcon,
  SaveIcon,
  Settings2Icon,
  WrenchIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";
import { CodeBlock } from "./CodeBlock";

type FileScope = "repo" | "agents" | "skills";
type WorkspaceTab = "files" | "optidev" | "plugins";
type MarkdownMode = "rendered" | "source";

interface OptiDevProjectRecord {
  name: string;
  path: string;
}

interface OptiDevSessionState {
  project: string | null;
  projectPath: string | null;
  status: string;
  muxBackend: string | null;
  sessionName: string | null;
  runner: string | null;
  hooksRunning: number;
  hooksTotal: number;
  mode: string | null;
  branch: string | null;
  headCommit: string | null;
  activeTask: string | null;
  agentsCount: number;
  manifestValid: boolean;
}

interface OptiDevState {
  repoRoot: string;
  status: string;
  logs: string;
  projects: OptiDevProjectRecord[];
  memorySummary: string[];
  session: OptiDevSessionState;
}

interface StateEnvelope {
  warnings: string[];
  state: OptiDevState;
}

interface DirectoryEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
  size: number | null;
}

interface DirectoryPayload {
  scope: FileScope;
  path: string;
  entries: DirectoryEntry[];
}

interface FilePayload {
  scope: FileScope;
  path: string;
  name: string;
  kind: "markdown" | "image" | "code" | "text" | "binary";
  language: string | null;
  content: string | null;
  size: number;
  editable: boolean;
}

interface TelegramConfigPayload {
  botToken: string;
  chatId: string;
}

interface ActionResponse {
  ok: boolean;
  lines: string[];
}

async function readJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json()) as {
    ok?: boolean;
    lines?: string[];
    state?: unknown;
    data?: unknown;
  };
  if (!response.ok || body.ok === false) {
    throw new Error(body.lines?.join("\n") || `Request failed: ${response.status}`);
  }
  return body as T;
}

async function fetchState(): Promise<StateEnvelope> {
  const body = await readJson<{
    lines?: string[];
    state: OptiDevState;
  }>("/api/optidev/state");
  return {
    warnings: body.lines ?? [],
    state: body.state,
  };
}

async function runAction(payload: Record<string, unknown>): Promise<ActionResponse> {
  return readJson<ActionResponse>("/api/optidev/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function fetchDirectory(scope: FileScope, currentPath: string): Promise<DirectoryPayload> {
  const params = new URLSearchParams({ scope, path: currentPath });
  const body = await readJson<{ data: DirectoryPayload }>(`/api/optidev/fs/list?${params.toString()}`);
  return body.data;
}

async function fetchFile(scope: FileScope, currentPath: string): Promise<FilePayload> {
  const params = new URLSearchParams({ scope, path: currentPath });
  const body = await readJson<{ data: FilePayload }>(`/api/optidev/fs/read?${params.toString()}`);
  return body.data;
}

async function savePluginFile(scope: "agents" | "skills", filePath: string, content: string) {
  return readJson<{ lines: string[]; data: FilePayload }>("/api/optidev/fs/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, path: filePath, content }),
  });
}

async function fetchTelegramConfig(): Promise<TelegramConfigPayload> {
  const body = await readJson<{ data: TelegramConfigPayload }>("/api/optidev/telegram-config");
  return body.data;
}

async function saveTelegramConfig(payload: TelegramConfigPayload) {
  return readJson<{ lines: string[]; data: TelegramConfigPayload }>("/api/optidev/telegram-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function pathSegments(currentPath: string): string[] {
  return currentPath.split("/").filter((segment) => segment.length > 0);
}

function parentPath(currentPath: string): string {
  const segments = pathSegments(currentPath);
  return segments.slice(0, -1).join("/");
}

function formatBytes(size: number | null): string {
  if (size == null) {
    return "";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileRawUrl(scope: FileScope, currentPath: string): string {
  const params = new URLSearchParams({ scope, path: currentPath });
  return `/api/optidev/fs/raw?${params.toString()}`;
}

function SectionTabs(props: {
  activeTab: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
}) {
  const items: Array<{ id: WorkspaceTab; label: string; icon: typeof FolderOpenIcon }> = [
    { id: "files", label: "Files", icon: FolderOpenIcon },
    { id: "optidev", label: "OptiDev", icon: Settings2Icon },
    { id: "plugins", label: "Plugins", icon: WrenchIcon },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active = props.activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            data-testid={`optidev-tab-${item.id}`}
            onClick={() => props.onSelect(item.id)}
          >
            <Icon className="size-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function DirectoryBrowser(props: {
  scope: FileScope;
  currentPath: string;
  selectedPath: string;
  title: string;
  description: string;
  onOpenDirectory: (nextPath: string) => void;
  onSelectFile: (nextPath: string) => void;
}) {
  const directoryQuery = useQuery({
    queryKey: ["optidev", "dir", props.scope, props.currentPath],
    queryFn: () => fetchDirectory(props.scope, props.currentPath),
  });
  const entries = directoryQuery.data?.entries ?? [];

  return (
    <Card className="min-h-0 overflow-hidden">
      <CardHeader className="gap-3 border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{props.title}</CardTitle>
            <CardDescription>{props.description}</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={props.currentPath.length === 0}
            onClick={() => props.onOpenDirectory(parentPath(props.currentPath))}
          >
            Up
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <button
            type="button"
            className="rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
            onClick={() => props.onOpenDirectory("")}
          >
            root
          </button>
          {pathSegments(props.currentPath).map((segment, index, all) => {
            const nextPath = all.slice(0, index + 1).join("/");
            return (
              <div key={nextPath} className="flex items-center gap-1">
                <ChevronRightIcon className="size-3" />
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
                  onClick={() => props.onOpenDirectory(nextPath)}
                >
                  {segment}
                </button>
              </div>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="min-h-0 overflow-y-auto p-0">
        {directoryQuery.isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Loading files...
          </div>
        ) : directoryQuery.isError ? (
          <div className="p-4 text-sm text-destructive">
            {directoryQuery.error instanceof Error ? directoryQuery.error.message : "Unable to read directory."}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No files in this folder.</div>
        ) : (
          <div className="divide-y divide-border/60">
            {entries.map((entry) => {
              const active = props.selectedPath === entry.path;
              const Icon = entry.kind === "directory" ? FolderIcon : FileIcon;
              return (
                <button
                  key={entry.path}
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                    active ? "bg-primary/8 text-foreground" : "hover:bg-accent"
                  }`}
                  data-testid={`optidev-entry-${props.scope}-${entry.path.replaceAll("/", "__") || "root"}`}
                  onClick={() =>
                    entry.kind === "directory"
                      ? props.onOpenDirectory(entry.path)
                      : props.onSelectFile(entry.path)
                  }
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{entry.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(entry.size)}</span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FileViewer(props: {
  scope: FileScope;
  selectedPath: string;
  markdownMode: MarkdownMode;
  onMarkdownModeChange: (mode: MarkdownMode) => void;
}) {
  const fileQuery = useQuery({
    enabled: props.selectedPath.length > 0,
    queryKey: ["optidev", "file", props.scope, props.selectedPath],
    queryFn: () => fetchFile(props.scope, props.selectedPath),
  });

  if (props.selectedPath.length === 0) {
    return (
      <Card className="min-h-0">
        <CardContent className="flex h-full min-h-[320px] items-center justify-center p-6 text-sm text-muted-foreground">
          Select a file to preview it.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-h-0 overflow-hidden">
      <CardHeader className="border-b border-border/70">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {fileQuery.data?.kind === "image" ? (
                <FileImageIcon className="size-4" />
              ) : (
                <FileCode2Icon className="size-4" />
              )}
              {props.selectedPath}
            </CardTitle>
            <CardDescription>
              {fileQuery.data ? `${fileQuery.data.kind} · ${formatBytes(fileQuery.data.size)}` : "Loading file..."}
            </CardDescription>
          </div>
          {fileQuery.data?.kind === "markdown" ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={props.markdownMode === "rendered" ? "default" : "outline"}
                onClick={() => props.onMarkdownModeChange("rendered")}
              >
                Rendered
              </Button>
              <Button
                size="sm"
                variant={props.markdownMode === "source" ? "default" : "outline"}
                onClick={() => props.onMarkdownModeChange("source")}
              >
                Source
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="min-h-0 overflow-y-auto p-6">
        {fileQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Loading preview...
          </div>
        ) : fileQuery.isError ? (
          <div className="text-sm text-destructive">
            {fileQuery.error instanceof Error ? fileQuery.error.message : "Unable to read file."}
          </div>
        ) : fileQuery.data?.kind === "image" ? (
          <img
            alt={fileQuery.data.name}
            className="max-h-[70vh] rounded-xl border border-border bg-muted/30 object-contain"
            src={fileRawUrl(props.scope, props.selectedPath)}
          />
        ) : fileQuery.data?.kind === "markdown" && props.markdownMode === "rendered" ? (
          <article className="prose prose-sm max-w-none prose-headings:tracking-tight dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {fileQuery.data.content ?? ""}
            </ReactMarkdown>
          </article>
        ) : fileQuery.data?.kind === "code" ? (
          <CodeBlock code={fileQuery.data.content ?? ""} language={fileQuery.data.language} />
        ) : fileQuery.data?.kind === "binary" ? (
          <div className="text-sm text-muted-foreground">Binary preview is not supported in the embedded viewer.</div>
        ) : (
          <pre className="overflow-x-auto rounded-xl border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
            {fileQuery.data?.content ?? ""}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

export function OptiDevWorkspace() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("files");
  const [target, setTarget] = useState(".");
  const [cloneName, setCloneName] = useState("feature-sandbox");
  const [memoryKind, setMemoryKind] = useState("feature");
  const [memoryIdentifier, setMemoryIdentifier] = useState("runtime-ts-002");
  const [output, setOutput] = useState("No OptiDev action yet.");
  const [repoPath, setRepoPath] = useState("");
  const [selectedRepoFile, setSelectedRepoFile] = useState("");
  const [pluginScope, setPluginScope] = useState<"agents" | "skills">("agents");
  const [pluginPath, setPluginPath] = useState("");
  const [selectedPluginFile, setSelectedPluginFile] = useState("");
  const [pluginDraftPath, setPluginDraftPath] = useState("new-entry.md");
  const [pluginEditorContent, setPluginEditorContent] = useState("");
  const [markdownMode, setMarkdownMode] = useState<MarkdownMode>("rendered");
  const [telegramForm, setTelegramForm] = useState<TelegramConfigPayload>({
    botToken: "",
    chatId: "",
  });

  const stateQuery = useQuery({
    queryKey: ["optidev", "state"],
    queryFn: fetchState,
    refetchInterval: 15_000,
  });

  const pluginFileQuery = useQuery({
    enabled: selectedPluginFile.length > 0,
    queryKey: ["optidev", "file", pluginScope, selectedPluginFile],
    queryFn: () => fetchFile(pluginScope, selectedPluginFile),
  });

  const telegramQuery = useQuery({
    queryKey: ["optidev", "telegram-config"],
    queryFn: fetchTelegramConfig,
  });

  useEffect(() => {
    if (pluginFileQuery.data?.content != null) {
      setPluginEditorContent(pluginFileQuery.data.content);
    }
  }, [pluginFileQuery.data?.path, pluginFileQuery.data?.content]);

  useEffect(() => {
    if (telegramQuery.data) {
      setTelegramForm(telegramQuery.data);
    }
  }, [telegramQuery.data]);

  useEffect(() => {
    setPluginPath("");
    setSelectedPluginFile("");
    setPluginEditorContent("");
  }, [pluginScope]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["optidev"] }),
      queryClient.invalidateQueries({ queryKey: ["optidev", "telegram-config"] }),
    ]);
  };

  const actionMutation = useMutation({
    mutationFn: runAction,
    onSuccess: async (result) => {
      setOutput(result.lines.join("\n") || "Command completed.");
      await refreshAll();
    },
    onError: (error) => {
      setOutput(error instanceof Error ? error.message : "OptiDev action failed.");
    },
  });

  const savePluginMutation = useMutation({
    mutationFn: (input: { scope: "agents" | "skills"; path: string; content: string }) =>
      savePluginFile(input.scope, input.path, input.content),
    onSuccess: async (result, variables) => {
      setOutput(result.lines.join("\n"));
      setSelectedPluginFile(variables.path);
      setPluginPath(parentPath(variables.path));
      await queryClient.invalidateQueries({ queryKey: ["optidev", "dir", variables.scope] });
      await queryClient.invalidateQueries({ queryKey: ["optidev", "file", variables.scope, variables.path] });
    },
    onError: (error) => {
      setOutput(error instanceof Error ? error.message : "Failed to save plugin file.");
    },
  });

  const saveTelegramMutation = useMutation({
    mutationFn: saveTelegramConfig,
    onSuccess: async (result) => {
      setTelegramForm(result.data);
      setOutput(result.lines.join("\n"));
      await queryClient.invalidateQueries({ queryKey: ["optidev", "telegram-config"] });
    },
    onError: (error) => {
      setOutput(error instanceof Error ? error.message : "Failed to save Telegram settings.");
    },
  });

  const resolvedTarget = target.trim() || ".";
  const state = stateQuery.data?.state;

  const sessionRows = useMemo(
    () =>
      state
        ? [
            ["Project", state.session.project ?? "No active session"],
            ["Runner", state.session.runner ?? "n/a"],
            ["Mux", state.session.muxBackend ?? "n/a"],
            ["Mode", state.session.mode ?? "n/a"],
            ["Branch", state.session.branch ?? "n/a"],
            ["Task", state.session.activeTask ?? "n/a"],
            ["Hooks", `${state.session.hooksRunning}/${state.session.hooksTotal}`],
            ["Agents", String(state.session.agentsCount)],
            ["Manifest", state.session.manifestValid ? "valid" : "missing or invalid"],
          ]
        : [],
    [state],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
      <div className="flex shrink-0 flex-col gap-4 border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Embedded In T3 Code
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">OptiDev Workspace</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Remove repo friction from one place: inspect files, restore or steer the current session,
              and edit agents, skills, plus Telegram settings without leaving the T3 shell.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCwIcon className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
        <SectionTabs activeTab={activeTab} onSelect={setActiveTab} />
        {stateQuery.data?.warnings.length ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            {stateQuery.data.warnings.join(" ")}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-5">
        {stateQuery.isLoading ? (
          <div className="flex h-full items-center justify-center gap-3 text-sm text-muted-foreground">
            <Spinner className="size-5" />
            Loading OptiDev workspace...
          </div>
        ) : stateQuery.isError ? (
          <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>OptiDev failed to load</CardTitle>
                <CardDescription>
                  {stateQuery.error instanceof Error ? stateQuery.error.message : "Unknown loading error."}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : activeTab === "files" ? (
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <DirectoryBrowser
              scope="repo"
              currentPath={repoPath}
              selectedPath={selectedRepoFile}
              title="Repository Files"
              description={`Browse ${state?.repoRoot ?? "the current repository"} without leaving T3.`}
              onOpenDirectory={(nextPath) => {
                setRepoPath(nextPath);
                setSelectedRepoFile("");
              }}
              onSelectFile={setSelectedRepoFile}
            />
            <FileViewer
              scope="repo"
              selectedPath={selectedRepoFile}
              markdownMode={markdownMode}
              onMarkdownModeChange={setMarkdownMode}
            />
          </div>
        ) : activeTab === "optidev" ? (
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
              <Card>
                <CardHeader>
                  <CardTitle>Session</CardTitle>
                  <CardDescription>Current restore/runtime state from the native OptiDev backend.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sessionRows.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-right font-medium">{value}</span>
                    </div>
                  ))}
                  {state?.session.headCommit ? (
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Head commit: {state.session.headCommit}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Runtime Controls</CardTitle>
                  <CardDescription>Start, restore, reset, and clone without dropping out of the shell.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="optidev-target">Target</Label>
                    <Input
                      id="optidev-target"
                      data-testid="optidev-target"
                      value={target}
                      onChange={(event) => setTarget(event.currentTarget.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button data-testid="optidev-start" onClick={() => actionMutation.mutate({ action: "start", target: resolvedTarget })}>
                      Start
                    </Button>
                    <Button variant="outline" onClick={() => actionMutation.mutate({ action: "go", target: resolvedTarget })}>
                      Go
                    </Button>
                    <Button variant="outline" onClick={() => actionMutation.mutate({ action: "resume", target: resolvedTarget })}>
                      Resume
                    </Button>
                    <Button variant="outline" onClick={() => actionMutation.mutate({ action: "reset", target: resolvedTarget })}>
                      Reset
                    </Button>
                    <Button variant="outline" onClick={() => actionMutation.mutate({ action: "stop" })}>
                      Stop
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="optidev-clone-name">Workspace clone</Label>
                    <div className="flex gap-2">
                      <Input
                        id="optidev-clone-name"
                        data-testid="optidev-clone-name"
                        value={cloneName}
                        onChange={(event) => setCloneName(event.currentTarget.value)}
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          actionMutation.mutate({
                            action: "workspace_clone",
                            target: resolvedTarget,
                            name: cloneName.trim(),
                          })
                        }
                      >
                        Clone
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      data-testid="optidev-open-loops"
                      onClick={() => actionMutation.mutate({ action: "memory_open_loops", target: resolvedTarget })}
                    >
                      Open loops
                    </Button>
                    <Button
                      variant="outline"
                      data-testid="optidev-advice"
                      onClick={() => actionMutation.mutate({ action: "plugin", command: "advice", args: [] })}
                    >
                      Advice
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid min-h-0 gap-4 lg:grid-cols-2">
              <Card className="min-h-0 overflow-hidden">
                <CardHeader>
                  <CardTitle>Memory</CardTitle>
                  <CardDescription>Use the current repo memory graph instead of re-discovering context.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-col gap-4 overflow-y-auto">
                  <div className="space-y-2">
                    {(state?.memorySummary ?? []).map((line) => (
                      <div key={line} className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-2 md:grid-cols-[120px_minmax(0,1fr)_auto]">
                    <Input value={memoryKind} onChange={(event) => setMemoryKind(event.currentTarget.value)} />
                    <Input
                      value={memoryIdentifier}
                      onChange={(event) => setMemoryIdentifier(event.currentTarget.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={() =>
                        actionMutation.mutate({
                          action: "memory_show",
                          target: resolvedTarget,
                          kind: memoryKind.trim(),
                          identifier: memoryIdentifier.trim(),
                        })
                      }
                    >
                      Show
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-h-0 overflow-hidden">
                <CardHeader>
                  <CardTitle>Projects And Logs</CardTitle>
                  <CardDescription>Keep discovered projects and runtime output visible beside the controls.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-col gap-4 overflow-y-auto">
                  <div data-testid="optidev-projects" className="space-y-2">
                    {state?.projects.map((project) => (
                      <div key={`${project.name}:${project.path}`} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                        <div className="font-medium">{project.name}</div>
                        <div className="break-all text-xs text-muted-foreground">{project.path}</div>
                      </div>
                    ))}
                  </div>
                  <pre className="rounded-xl border border-border bg-muted/20 p-4 text-sm whitespace-pre-wrap" data-testid="optidev-status">
                    {state?.status}
                  </pre>
                  <pre className="rounded-xl border border-border bg-muted/20 p-4 text-xs whitespace-pre-wrap">
                    {state?.logs}
                  </pre>
                  <pre className="rounded-xl border border-border bg-card p-4 text-sm whitespace-pre-wrap" data-testid="optidev-output">
                    {output}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col gap-4">
              <DirectoryBrowser
                scope={pluginScope}
                currentPath={pluginPath}
                selectedPath={selectedPluginFile}
                title={pluginScope === "agents" ? "Agent Files" : "Skill Files"}
                description="Edit repo-local automation assets without leaving the shell."
                onOpenDirectory={(nextPath) => {
                  setPluginPath(nextPath);
                  setSelectedPluginFile("");
                }}
                onSelectFile={setSelectedPluginFile}
              />
              <Card>
                <CardHeader>
                  <CardTitle>Plugin Scope</CardTitle>
                  <CardDescription>Switch between agents and skills, then open or create a file.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant={pluginScope === "agents" ? "default" : "outline"}
                      onClick={() => setPluginScope("agents")}
                    >
                      <BotIcon className="mr-2 size-4" />
                      Agents
                    </Button>
                    <Button
                      variant={pluginScope === "skills" ? "default" : "outline"}
                      onClick={() => setPluginScope("skills")}
                    >
                      <BookMarkedIcon className="mr-2 size-4" />
                      Skills
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plugin-new-path">Create or overwrite file</Label>
                    <div className="flex gap-2">
                      <Input
                        id="plugin-new-path"
                        value={pluginDraftPath}
                        onChange={(event) => setPluginDraftPath(event.currentTarget.value)}
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          savePluginMutation.mutate({
                            scope: pluginScope,
                            path: pluginDraftPath.trim(),
                            content: "",
                          })
                        }
                      >
                        Create
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid min-h-0 gap-4 lg:grid-rows-[minmax(0,1fr)_auto]">
              <Card className="min-h-0 overflow-hidden">
                <CardHeader>
                  <CardTitle>{selectedPluginFile || "Plugin Editor"}</CardTitle>
                  <CardDescription>Edit the selected agent or skill file directly in the forked UI.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-col gap-4 overflow-hidden">
                  {selectedPluginFile.length === 0 ? (
                    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                      Select or create a plugin file to edit it.
                    </div>
                  ) : (
                    <>
                      {pluginFileQuery.isError ? (
                        <div className="text-sm text-destructive">
                          {pluginFileQuery.error instanceof Error ? pluginFileQuery.error.message : "Failed to load plugin file."}
                        </div>
                      ) : null}
                      <Textarea
                        className="min-h-0 flex-1 resize-none font-mono text-sm"
                        data-testid="optidev-plugin-editor"
                        value={pluginEditorContent}
                        onChange={(event) => setPluginEditorContent(event.currentTarget.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setPluginEditorContent(pluginFileQuery.data?.content ?? "")}
                        >
                          Revert
                        </Button>
                        <Button
                          data-testid="optidev-plugin-save"
                          onClick={() =>
                            savePluginMutation.mutate({
                              scope: pluginScope,
                              path: selectedPluginFile,
                              content: pluginEditorContent,
                            })
                          }
                        >
                          <SaveIcon className="mr-2 size-4" />
                          Save
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Telegram</CardTitle>
                  <CardDescription>Keep bridge credentials and lifecycle controls near the rest of your automation surface.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="telegram-token">Bot token</Label>
                      <Input
                        id="telegram-token"
                        data-testid="optidev-telegram-token"
                        value={telegramForm.botToken}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          setTelegramForm((current) => ({ ...current, botToken: nextValue }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telegram-chat-id">Chat ID</Label>
                      <Input
                        id="telegram-chat-id"
                        data-testid="optidev-telegram-chat-id"
                        value={telegramForm.chatId}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          setTelegramForm((current) => ({ ...current, chatId: nextValue }));
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button data-testid="optidev-telegram-save" onClick={() => saveTelegramMutation.mutate(telegramForm)}>
                      Save settings
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => actionMutation.mutate({ action: "plugin", command: "telegram", args: ["status"] })}
                    >
                      Status
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => actionMutation.mutate({ action: "plugin", command: "telegram", args: ["start"] })}
                    >
                      Start bridge
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => actionMutation.mutate({ action: "plugin", command: "telegram", args: ["stop"] })}
                    >
                      Stop bridge
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <pre className="text-sm whitespace-pre-wrap" data-testid="optidev-output">
                    {output}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
