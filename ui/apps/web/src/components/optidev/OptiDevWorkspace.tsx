import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileCode2Icon,
  FileIcon,
  FileImageIcon,
  FolderIcon,
  RefreshCwIcon,
  SaveIcon,
  Settings2Icon,
  WrenchIcon,
} from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";

import ChatMarkdown from "../ChatMarkdown";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SidebarTrigger } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";
import { CodeBlock } from "./CodeBlock";
import {
  readStoredOptiDevTab,
  setStoredOptiDevTab,
  subscribeOptiDevTab,
  type OptiDevWorkspaceTab,
} from "./optidevTabs";

type FileScope = "repo" | "agents" | "skills";
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

interface ManifestPayload {
  path: string;
  content: string;
  manifest: {
    project: string;
    workspace: {
      active_task: string;
      branch: string;
      head_commit: string;
      mux: string;
    };
    agents: Array<{ name: string; runner: string }>;
    layout: Array<{ name: string; pane: string }>;
    services: Array<{ name: string; command: string }>;
    tests: { command: string };
    logs: { command: string };
    context: {
      agents_dir: string;
      skills_dir: string;
      mcp_dir: string;
    };
  };
  impacts: Array<{
    field: string;
    before: string;
    after: string;
    effect: string;
  }>;
  runtimeNotes: string[];
}

interface MemoryGraphPayload {
  project: string;
  focusNodeId: string | null;
  nodes: Array<{
    id: string;
    kind: "project" | "release" | "task" | "feature" | "decision" | "open_loop";
    label: string;
    status: string | null;
    group: string;
    highlight: boolean;
  }>;
  edges: Array<{
    source: string;
    target: string;
    kind: string;
  }>;
  stats: {
    features: number;
    tasks: number;
    releases: number;
    decisions: number;
    openLoops: number;
  };
  implementationNotes: string[];
}

interface PluginInventoryEntry {
  id: string;
  title: string;
  category: "analysis" | "integration" | "catalog";
  enabled: boolean;
  summary: string;
  details: string[];
}

interface ActionResponse {
  ok: boolean;
  lines: string[];
  data?: unknown;
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
  const body = await readJson<{ lines?: string[]; state: OptiDevState }>("/api/optidev/state");
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

async function fetchManifest(): Promise<ManifestPayload> {
  const body = await readJson<{ data: ManifestPayload }>("/api/optidev/manifest");
  return body.data;
}

async function previewManifest(content: string): Promise<ManifestPayload> {
  const body = await readJson<{ data: ManifestPayload }>("/api/optidev/manifest/impact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return body.data;
}

async function saveManifest(content: string): Promise<{ lines: string[]; data: ManifestPayload }> {
  return readJson<{ lines: string[]; data: ManifestPayload }>("/api/optidev/manifest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

async function fetchMemoryGraph(): Promise<MemoryGraphPayload> {
  const body = await readJson<{ data: MemoryGraphPayload }>("/api/optidev/memory-graph");
  return body.data;
}

async function fetchPluginInventory(): Promise<PluginInventoryEntry[]> {
  const body = await readJson<{ data: PluginInventoryEntry[] }>("/api/optidev/plugins");
  return body.data;
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
  activeTab: OptiDevWorkspaceTab;
  onSelect: (tab: OptiDevWorkspaceTab) => void;
}) {
  const items: Array<{ id: OptiDevWorkspaceTab; label: string; icon: typeof Settings2Icon }> = [
    { id: "files", label: "Files", icon: FileCode2Icon },
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
              <button
                key={nextPath}
                type="button"
                className="rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
                onClick={() => props.onOpenDirectory(nextPath)}
              >
                / {segment}
              </button>
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
  repoRoot: string;
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
          <div className="rounded-xl border border-border bg-muted/10 p-4">
            <ChatMarkdown cwd={props.repoRoot} text={fileQuery.data.content ?? ""} />
          </div>
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

function ManifestSummary(props: { payload: ManifestPayload | undefined }) {
  const manifest = props.payload?.manifest;
  if (!manifest) {
    return null;
  }

  const rows = [
    ["Project", manifest.project],
    ["Branch", manifest.workspace.branch || "n/a"],
    ["Active task", manifest.workspace.active_task || "not pinned"],
    ["Agents", String(manifest.agents.length)],
    ["Services", String(manifest.services.length)],
    ["Layout", manifest.layout.map((item) => item.name).join(", ") || "default"],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border bg-muted/20 px-3 py-3">
          <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</div>
          <div className="mt-1 text-sm font-medium">{value}</div>
        </div>
      ))}
    </div>
  );
}

export function OptiDevWorkspace() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<OptiDevWorkspaceTab>(() => readStoredOptiDevTab());
  const [repoPath, setRepoPath] = useState("");
  const [selectedRepoFile, setSelectedRepoFile] = useState("");
  const [markdownMode, setMarkdownMode] = useState<MarkdownMode>("rendered");
  const [manifestDraft, setManifestDraft] = useState("");
  const [cloneName, setCloneName] = useState("feature-sandbox");
  const [memoryKind, setMemoryKind] = useState("feature");
  const [memoryIdentifier, setMemoryIdentifier] = useState("runtime-ts-002");
  const [output, setOutput] = useState("Manifest-first workspace ready.");

  const deferredManifestDraft = useDeferredValue(manifestDraft);

  const stateQuery = useQuery({
    queryKey: ["optidev", "state"],
    queryFn: fetchState,
    refetchInterval: 15_000,
  });

  const manifestQuery = useQuery({
    queryKey: ["optidev", "manifest"],
    queryFn: fetchManifest,
  });

  const manifestImpactQuery = useQuery({
    enabled:
      deferredManifestDraft.trim().length > 0 &&
      manifestQuery.data !== undefined &&
      deferredManifestDraft !== manifestQuery.data.content,
    queryKey: ["optidev", "manifest-impact", deferredManifestDraft],
    queryFn: () => previewManifest(deferredManifestDraft),
  });

  const memoryGraphQuery = useQuery({
    queryKey: ["optidev", "memory-graph"],
    queryFn: fetchMemoryGraph,
  });

  const pluginsQuery = useQuery({
    queryKey: ["optidev", "plugins"],
    queryFn: fetchPluginInventory,
  });

  useEffect(() => subscribeOptiDevTab(setActiveTab), []);

  useEffect(() => {
    if (manifestQuery.data) {
      setManifestDraft(manifestQuery.data.content);
    }
  }, [manifestQuery.data?.content]);

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["optidev"] });
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

  const saveManifestMutation = useMutation({
    mutationFn: saveManifest,
    onSuccess: async (result) => {
      setManifestDraft(result.data.content);
      setOutput(result.lines.join("\n"));
      await refreshAll();
    },
    onError: (error) => {
      setOutput(error instanceof Error ? error.message : "Failed to save manifest.");
    },
  });

  const state = stateQuery.data?.state;
  const manifestPreview = manifestImpactQuery.data ?? manifestQuery.data;
  const resolvedTarget = state?.session.project ?? ".";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
      <div className="flex shrink-0 flex-col gap-4 border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <SidebarTrigger className="shrink-0 md:hidden" />
              <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Manifest First
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">OptiDev Workspace</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              The manifest is the contract. Runtime controls simply apply that contract to the live workspace.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCwIcon className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
        <SectionTabs
          activeTab={activeTab}
          onSelect={(tab) => {
            setStoredOptiDevTab(tab);
            setActiveTab(tab);
          }}
        />
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
              description={`Browse ${state?.repoRoot ?? "the current repository"} with the shared t3 markdown renderer.`}
              onOpenDirectory={(nextPath) => {
                setRepoPath(nextPath);
                setSelectedRepoFile("");
              }}
              onSelectFile={setSelectedRepoFile}
            />
            <FileViewer
              scope="repo"
              selectedPath={selectedRepoFile}
              repoRoot={state?.repoRoot ?? ""}
              markdownMode={markdownMode}
              onMarkdownModeChange={setMarkdownMode}
            />
          </div>
        ) : activeTab === "optidev" ? (
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
              <Card className="min-h-0 overflow-hidden">
                <CardHeader>
                  <CardTitle>Workspace Manifest</CardTitle>
                  <CardDescription data-testid="optidev-manifest-path">
                    {manifestQuery.data?.path ?? ".optidev/workspace.yaml"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ManifestSummary payload={manifestPreview} />
                  <div className="space-y-2">
                    <Label htmlFor="optidev-manifest-editor">Manifest YAML</Label>
                    <Textarea
                      id="optidev-manifest-editor"
                      data-testid="optidev-manifest-editor"
                      className="min-h-[340px] font-mono text-sm"
                      value={manifestDraft}
                      onChange={(event) => setManifestDraft(event.currentTarget.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      data-testid="optidev-manifest-save"
                      disabled={saveManifestMutation.isPending || manifestDraft.trim().length === 0}
                      onClick={() => saveManifestMutation.mutate(manifestDraft)}
                    >
                      <SaveIcon className="mr-2 size-4" />
                      {saveManifestMutation.isPending ? "Saving..." : "Save manifest"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (manifestQuery.data) {
                          setManifestDraft(manifestQuery.data.content);
                        }
                      }}
                    >
                      Revert draft
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>What Changes If You Edit It</CardTitle>
                  <CardDescription>
                    Draft impact is computed from the current saved manifest and the live session contract.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {manifestImpactQuery.isFetching ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner className="size-4" />
                      Previewing manifest impact...
                    </div>
                  ) : null}
                  {(manifestPreview?.impacts.length ?? 0) > 0 ? (
                    manifestPreview?.impacts.map((impact) => (
                      <div key={`${impact.field}:${impact.after}`} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                        <div className="text-sm font-medium">{impact.field}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {impact.before || "empty"} -&gt; {impact.after || "empty"}
                        </div>
                        <div className="mt-2 text-sm">{impact.effect}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                      No runtime-visible delta in the current draft. Edit the manifest to see exact effects.
                    </div>
                  )}
                  <div className="rounded-xl border border-border bg-card px-4 py-3">
                    <div className="text-sm font-medium">Why runtime controls still exist</div>
                    <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {manifestPreview?.runtimeNotes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Live Session</CardTitle>
                  <CardDescription>Current runtime snapshot for the active workspace session.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Project", state?.session.project ?? "No active session"],
                    ["Status", state?.session.status ?? "inactive"],
                    ["Runner", state?.session.runner ?? "n/a"],
                    ["Mode", state?.session.mode ?? "n/a"],
                    ["Branch", state?.session.branch ?? "n/a"],
                    ["Active task", state?.session.activeTask ?? "n/a"],
                    ["Hooks", `${state?.session.hooksRunning ?? 0}/${state?.session.hooksTotal ?? 0}`],
                    ["Manifest", state?.session.manifestValid ? "valid" : "missing or invalid"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border bg-muted/20 px-3 py-3">
                      <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</div>
                      <div className="mt-1 text-sm font-medium">{value}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Runtime Controls</CardTitle>
                  <CardDescription>Apply the saved manifest to the live workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button data-testid="optidev-start" onClick={() => actionMutation.mutate({ action: "start", target: resolvedTarget })}>
                      Start
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
                    <Label htmlFor="optidev-clone-name">Clone manifest to workspace</Label>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Memory</CardTitle>
                  <CardDescription>
                    The data is already graph-backed; the current gap is visualization, not storage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {memoryGraphQuery.data ? (
                      <>
                        <div className="rounded-xl border border-border bg-muted/20 px-3 py-3">
                          <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Nodes</div>
                          <div className="mt-1 text-sm">
                            {memoryGraphQuery.data.nodes.length} total
                          </div>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/20 px-3 py-3">
                          <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Edges</div>
                          <div className="mt-1 text-sm">
                            {memoryGraphQuery.data.edges.length} total
                          </div>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/20 px-3 py-3">
                          <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Features</div>
                          <div className="mt-1 text-sm">{memoryGraphQuery.data.stats.features}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/20 px-3 py-3">
                          <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Open loops</div>
                          <div className="mt-1 text-sm">{memoryGraphQuery.data.stats.openLoops}</div>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {(state?.memorySummary ?? []).map((line) => (
                      <div key={line} className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border bg-card px-4 py-3">
                    <div className="text-sm font-medium">Graph view implementation path</div>
                    <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {memoryGraphQuery.data?.implementationNotes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[120px_minmax(0,1fr)_auto_auto]">
                    <Input value={memoryKind} onChange={(event) => setMemoryKind(event.currentTarget.value)} />
                    <Input value={memoryIdentifier} onChange={(event) => setMemoryIdentifier(event.currentTarget.value)} />
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
                    <Button
                      variant="outline"
                      data-testid="optidev-open-loops"
                      onClick={() => actionMutation.mutate({ action: "memory_open_loops", target: resolvedTarget })}
                    >
                      Open loops
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Output</CardTitle>
                  <CardDescription>Status, logs, and action feedback stay visible but secondary.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <pre className="rounded-xl border border-border bg-muted/20 p-4 text-sm whitespace-pre-wrap" data-testid="optidev-status">
                    {state?.status}
                  </pre>
                  <pre className="rounded-xl border border-border bg-muted/20 p-4 text-xs whitespace-pre-wrap">{state?.logs}</pre>
                  <pre className="rounded-xl border border-border bg-card p-4 text-sm whitespace-pre-wrap" data-testid="optidev-output">
                    {output}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <Card className="min-h-0 overflow-hidden">
              <CardHeader>
                <CardTitle>Current Plugins</CardTitle>
                <CardDescription>
                  The screen is intentionally reduced to inventory only. Editing/config UX can come back later in a cleaner form.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 overflow-y-auto">
                {pluginsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    Loading plugins...
                  </div>
                ) : pluginsQuery.isError ? (
                  <div className="text-sm text-destructive">
                    {pluginsQuery.error instanceof Error ? pluginsQuery.error.message : "Failed to load plugins."}
                  </div>
                ) : (
                  pluginsQuery.data?.map((plugin) => (
                    <div
                      key={plugin.id}
                      className="rounded-2xl border border-border bg-muted/20 px-4 py-4"
                      data-testid={`optidev-plugin-${plugin.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{plugin.title}</div>
                          <div className="text-xs text-muted-foreground">{plugin.category}</div>
                        </div>
                        <div className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {plugin.enabled ? "enabled" : "available"}
                        </div>
                      </div>
                      <p className="mt-3 text-sm">{plugin.summary}</p>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {plugin.details.map((detail) => (
                          <div key={detail}>{detail}</div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projects</CardTitle>
                <CardDescription>The active route is focused on runtime plugins, not editing plugin files.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {state?.projects.map((project) => (
                  <div key={`${project.name}:${project.path}`} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <div className="font-medium">{project.name}</div>
                    <div className="break-all text-xs text-muted-foreground">{project.path}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
