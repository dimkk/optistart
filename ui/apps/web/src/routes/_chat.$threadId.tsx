import { ThreadId } from "@t3tools/contracts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, type ReactNode, useCallback, useEffect, useState } from "react";
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react";

import ChatView from "../components/ChatView";
import { useComposerDraftStore } from "../composerDraftStore";
import { parseDiffRouteSearch, stripDiffSearchParams } from "../diffRouteSearch";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useStore } from "../store";
import { Sheet, SheetPopup } from "../components/ui/sheet";
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail } from "~/components/ui/sidebar";
import { Button } from "~/components/ui/button";
import { readNativeApi } from "~/nativeApi";
import { debugOptiDev } from "../optidevDebug";

const DiffPanel = lazy(() => import("../components/DiffPanel"));
const DIFF_INLINE_LAYOUT_MEDIA_QUERY = "(max-width: 1180px)";
const DIFF_INLINE_SIDEBAR_WIDTH_STORAGE_KEY = "chat_diff_sidebar_width";
const DIFF_INLINE_DEFAULT_WIDTH = "clamp(28rem,48vw,44rem)";
const DIFF_INLINE_SIDEBAR_MIN_WIDTH = 26 * 16;
const THREAD_RESOLVE_RETRY_LIMIT = 10;
const THREAD_RESOLVE_RETRY_DELAY_MS = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function ThreadRouteStatusPanel(props: {
  mode: "loading" | "error";
  title: string;
  detail: string;
  onRetry?: () => void;
  onBack?: () => void;
  compact?: boolean;
}) {
  const Icon = props.mode === "error" ? CircleAlertIcon : LoaderCircleIcon;

  return (
    <div
      className={`flex items-center justify-center px-4 text-center ${
        props.compact ? "absolute inset-0 z-20 bg-background/78 backdrop-blur-[2px]" : "h-full"
      }`}
    >
      <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-border/70 bg-background/92 px-5 py-4 shadow-sm">
        <div
          className={`flex size-10 items-center justify-center rounded-full border ${
            props.mode === "error"
              ? "border-destructive/20 bg-destructive/8 text-destructive"
              : "border-primary/15 bg-primary/6 text-primary"
          }`}
        >
          <Icon className={`size-5 ${props.mode === "loading" ? "animate-spin" : ""}`} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{props.title}</p>
          <p className="text-xs leading-5 text-muted-foreground">{props.detail}</p>
        </div>
        {(props.onRetry || props.onBack) && (
          <div className="flex items-center gap-2">
            {props.onRetry ? (
              <Button type="button" size="sm" variant="default" onClick={props.onRetry}>
                Retry
              </Button>
            ) : null}
            {props.onBack ? (
              <Button type="button" size="sm" variant="outline" onClick={props.onBack}>
                Workspace
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

const DiffPanelSheet = (props: {
  children: ReactNode;
  diffOpen: boolean;
  onCloseDiff: () => void;
}) => {
  return (
    <Sheet
      open={props.diffOpen}
      onOpenChange={(open) => {
        if (!open) {
          props.onCloseDiff();
        }
      }}
    >
      <SheetPopup
        side="right"
        showCloseButton={false}
        keepMounted
        className="w-[min(88vw,820px)] max-w-[820px] p-0"
      >
        {props.children}
      </SheetPopup>
    </Sheet>
  );
};

const DiffLoadingFallback = (props: { inline: boolean }) => {
  if (props.inline) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-4 text-center text-xs text-muted-foreground/70">
        Loading diff viewer...
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[560px] shrink-0 items-center justify-center border-l border-border bg-card px-4 text-center text-xs text-muted-foreground/70">
      Loading diff viewer...
    </aside>
  );
};

const DiffPanelInlineSidebar = (props: {
  diffOpen: boolean;
  onCloseDiff: () => void;
  onOpenDiff: () => void;
}) => {
  const { diffOpen, onCloseDiff, onOpenDiff } = props;
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        onOpenDiff();
        return;
      }
      onCloseDiff();
    },
    [onCloseDiff, onOpenDiff],
  );
  const shouldAcceptInlineSidebarWidth = useCallback(
    ({ nextWidth, wrapper }: { nextWidth: number; wrapper: HTMLElement }) => {
      const composerForm = document.querySelector<HTMLElement>("[data-chat-composer-form='true']");
      if (!composerForm) return true;
      const composerViewport = composerForm.parentElement;
      if (!composerViewport) return true;
      const previousSidebarWidth = wrapper.style.getPropertyValue("--sidebar-width");
      wrapper.style.setProperty("--sidebar-width", `${nextWidth}px`);

      const viewportStyle = window.getComputedStyle(composerViewport);
      const viewportPaddingLeft = Number.parseFloat(viewportStyle.paddingLeft) || 0;
      const viewportPaddingRight = Number.parseFloat(viewportStyle.paddingRight) || 0;
      const viewportContentWidth = Math.max(
        0,
        composerViewport.clientWidth - viewportPaddingLeft - viewportPaddingRight,
      );
      const formRect = composerForm.getBoundingClientRect();
      const hasComposerOverflow = composerForm.scrollWidth > composerForm.clientWidth + 0.5;
      const overflowsViewport = formRect.width > viewportContentWidth + 0.5;

      if (previousSidebarWidth.length > 0) {
        wrapper.style.setProperty("--sidebar-width", previousSidebarWidth);
      } else {
        wrapper.style.removeProperty("--sidebar-width");
      }

      return !hasComposerOverflow && !overflowsViewport;
    },
    [],
  );

  return (
    <SidebarProvider
      defaultOpen={false}
      open={diffOpen}
      onOpenChange={onOpenChange}
      className="w-auto min-h-0 flex-none bg-transparent"
      style={{ "--sidebar-width": DIFF_INLINE_DEFAULT_WIDTH } as React.CSSProperties}
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="border-l border-border bg-card text-foreground"
        resizable={{
          minWidth: DIFF_INLINE_SIDEBAR_MIN_WIDTH,
          shouldAcceptWidth: shouldAcceptInlineSidebarWidth,
          storageKey: DIFF_INLINE_SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        <Suspense fallback={<DiffLoadingFallback inline />}>
          <DiffPanel mode="sidebar" />
        </Suspense>
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
};

function ChatThreadRouteView() {
  const threadsHydrated = useStore((store) => store.threadsHydrated);
  const syncServerReadModel = useStore((store) => store.syncServerReadModel);
  const navigate = useNavigate();
  const threadId = Route.useParams({
    select: (params) => ThreadId.makeUnsafe(params.threadId),
  });
  const search = Route.useSearch();
  const threadExists = useStore((store) => store.threads.some((thread) => thread.id === threadId));
  const draftThreadExists = useComposerDraftStore(
    (store) => Object.hasOwn(store.draftThreadsByThreadId, threadId),
  );
  const routeThreadExists = threadExists || draftThreadExists;
  const diffOpen = search.diff === "1";
  const shouldUseDiffSheet = useMediaQuery(DIFF_INLINE_LAYOUT_MEDIA_QUERY);
  const [isResolvingThread, setIsResolvingThread] = useState(false);
  const [lastResolvedThreadId, setLastResolvedThreadId] = useState<ThreadId | null>(null);
  const [threadResolveError, setThreadResolveError] = useState<string | null>(null);
  const [resolveNonce, setResolveNonce] = useState(0);

  useEffect(() => {
    debugOptiDev("chat.route.state", {
      threadId,
      threadsHydrated,
      threadExists,
      draftThreadExists,
      routeThreadExists,
      isResolvingThread,
      lastResolvedThreadId,
      threadResolveError,
      diffOpen,
    });
  }, [
    diffOpen,
    draftThreadExists,
    isResolvingThread,
    lastResolvedThreadId,
    routeThreadExists,
    threadExists,
    threadResolveError,
    threadId,
    threadsHydrated,
  ]);

  useEffect(() => {
    if (!routeThreadExists) {
      return;
    }
    setLastResolvedThreadId(threadId);
    setThreadResolveError(null);
  }, [routeThreadExists, threadId]);

  const closeDiff = useCallback(() => {
    void navigate({
      to: "/$threadId",
      params: { threadId },
      search: (previous) => {
        return stripDiffSearchParams(previous);
      },
    });
  }, [navigate, threadId]);
  const openDiff = useCallback(() => {
    void navigate({
      to: "/$threadId",
      params: { threadId },
      search: (previous) => {
        const rest = stripDiffSearchParams(previous);
        return { ...rest, diff: "1" };
      },
    });
  }, [navigate, threadId]);

  useEffect(() => {
    if (!threadsHydrated || routeThreadExists || isResolvingThread || threadResolveError) {
      return;
    }

    const api = readNativeApi();
    if (!api) {
      return;
    }

    let cancelled = false;
    setIsResolvingThread(true);
    setThreadResolveError(null);

    void (async () => {
      try {
        for (let attempt = 1; attempt <= THREAD_RESOLVE_RETRY_LIMIT; attempt += 1) {
          const snapshot = await api.orchestration.getSnapshot();
          if (cancelled) {
            return;
          }
          const matchedThread = snapshot.threads.find((thread) => thread.id === threadId) ?? null;
          debugOptiDev("chat.route.snapshot-fetched", {
            threadId,
            attempt,
            snapshotSequence: snapshot.snapshotSequence,
            threadCount: snapshot.threads.length,
            matchedThread: matchedThread
              ? {
                  id: matchedThread.id,
                  messageCount: matchedThread.messages.length,
                  sessionStatus: matchedThread.session?.status ?? null,
                }
              : null,
          });
          syncServerReadModel(snapshot);
          if (matchedThread) {
            return;
          }
          if (attempt < THREAD_RESOLVE_RETRY_LIMIT) {
            await wait(THREAD_RESOLVE_RETRY_DELAY_MS);
          }
        }
        if (!cancelled) {
          setThreadResolveError(
            "This session is still restoring. Retry or go back to the workspace while the backend catches up.",
          );
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          debugOptiDev("chat.route.snapshot-fetch-failed", {
            threadId,
            error: message,
          });
          setThreadResolveError(message || "Failed to load thread snapshot.");
        }
      } finally {
        if (!cancelled) {
          setIsResolvingThread(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isResolvingThread,
    resolveNonce,
    routeThreadExists,
    syncServerReadModel,
    threadId,
    threadResolveError,
    threadsHydrated,
  ]);

  const renderedThreadId = routeThreadExists ? threadId : lastResolvedThreadId;
  const shouldShowThreadTransitionOverlay =
    renderedThreadId !== null && (!routeThreadExists || isResolvingThread || threadResolveError !== null);
  const handleRetryResolve = useCallback(() => {
    setThreadResolveError(null);
    setResolveNonce((value) => value + 1);
  }, []);
  const handleBackToWorkspace = useCallback(() => {
    void navigate({ to: "/optidev" });
  }, [navigate]);

  if (!threadsHydrated || renderedThreadId === null) {
    return (
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ThreadRouteStatusPanel
          mode={threadResolveError ? "error" : "loading"}
          title={threadResolveError ? "Session unavailable" : "Opening chat…"}
          detail={
            threadResolveError ??
            "The selected session is loading. Keeping the chat route active while the runtime restores it."
          }
          {...(threadResolveError
            ? { onRetry: handleRetryResolve, onBack: handleBackToWorkspace }
            : {})}
        />
      </SidebarInset>
    );
  }

  if (!shouldUseDiffSheet) {
    return (
      <>
        <SidebarInset className="relative h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
          <ChatView key={renderedThreadId} threadId={renderedThreadId} />
          {shouldShowThreadTransitionOverlay ? (
            <ThreadRouteStatusPanel
              compact
              mode={threadResolveError ? "error" : "loading"}
              title={threadResolveError ? "Session still restoring" : "Opening session…"}
              detail={
                threadResolveError ??
                "The previous chat stays visible until the selected session is ready."
              }
              {...(threadResolveError
                ? { onRetry: handleRetryResolve, onBack: handleBackToWorkspace }
                : {})}
            />
          ) : null}
        </SidebarInset>
        <DiffPanelInlineSidebar diffOpen={diffOpen} onCloseDiff={closeDiff} onOpenDiff={openDiff} />
      </>
    );
  }

  return (
    <>
      <SidebarInset className="relative h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ChatView key={renderedThreadId} threadId={renderedThreadId} />
        {shouldShowThreadTransitionOverlay ? (
          <ThreadRouteStatusPanel
            compact
            mode={threadResolveError ? "error" : "loading"}
            title={threadResolveError ? "Session still restoring" : "Opening session…"}
            detail={
              threadResolveError ??
              "The previous chat stays visible until the selected session is ready."
            }
            {...(threadResolveError
              ? { onRetry: handleRetryResolve, onBack: handleBackToWorkspace }
              : {})}
          />
        ) : null}
      </SidebarInset>
      <DiffPanelSheet diffOpen={diffOpen} onCloseDiff={closeDiff}>
        <Suspense fallback={<DiffLoadingFallback inline={false} />}>
          <DiffPanel mode="sheet" />
        </Suspense>
      </DiffPanelSheet>
    </>
  );
}

export const Route = createFileRoute("/_chat/$threadId")({
  validateSearch: (search) => parseDiffRouteSearch(search),
  component: ChatThreadRouteView,
});
