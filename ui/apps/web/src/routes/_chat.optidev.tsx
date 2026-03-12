import { createFileRoute } from "@tanstack/react-router";

import { OptiDevWorkspace } from "../components/optidev/OptiDevWorkspace";
import { SidebarInset } from "~/components/ui/sidebar";

function OptiDevRouteView() {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <OptiDevWorkspace />
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/optidev")({
  component: OptiDevRouteView,
});
