import {
  Activity,
  BookOpenText,
  Bot,
  Navigation,
  Settings,
  SlidersHorizontal,
  SquareCode,
} from "lucide-react";
import { Spinner } from "./ui/spinner";

type ProjectDashboardLoadingKind =
  | "ai"
  | "api-reference"
  | "guides"
  | "metrics"
  | "navigation"
  | "settings"
  | "version-settings";

const loadingIcons = {
  ai: Bot,
  "api-reference": SquareCode,
  guides: BookOpenText,
  metrics: Activity,
  navigation: Navigation,
  settings: Settings,
  "version-settings": SlidersHorizontal,
} satisfies Record<ProjectDashboardLoadingKind, typeof Bot>;

export function ProjectDashboardLoadingPage({
  label,
  kind,
}: {
  label: string;
  kind: ProjectDashboardLoadingKind;
}) {
  const Icon = loadingIcons[kind];

  return (
    <div className="project-editor-shell flex min-h-svh w-full overflow-hidden bg-sidebar text-foreground">
      <div className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="space-y-4 p-4">
          <div className="h-8 w-32 rounded-md bg-sidebar-accent" />
          <div className="space-y-2 pt-3">
            <div className="h-3 w-16 rounded bg-sidebar-accent" />
            <div className="h-5 w-40 rounded bg-sidebar-accent" />
            <div className="h-9 w-full rounded-md bg-sidebar-accent" />
          </div>
          <div className="space-y-2 pt-4">
            <div className="h-8 w-full rounded-md bg-sidebar-accent" />
            <div className="h-8 w-full rounded-md bg-sidebar-accent/70" />
            <div className="h-8 w-full rounded-md bg-sidebar-accent/70" />
          </div>
        </div>
      </div>
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background px-5">
        <div className="flex min-w-0 flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Spinner />
            <span>{label}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
