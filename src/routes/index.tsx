import {
  Link,
  createFileRoute,
  isRedirect,
  notFound,
  redirect,
} from "@tanstack/react-router";
import {
  Bot,
  FileCode2,
  GitBranch,
  Layers3,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "../components/brand";
import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  publicDomainProjectQuery,
  publicProjectQueries,
} from "../lib/public-docs";
import { getPublicProjectSlugFromRequest } from "../lib/public-docs-domain";
import { SITE_DESCRIPTION, seoLinks, seoMeta, siteUrl } from "../lib/seo";
import projectDashboardImage from "../images/screenshot-1.png";
import endpointEditorImage from "../images/screenshot-2.png";
import richEditorImage from "../images/screenshot-3.png";
import navigationImage from "../images/screenshot-4.png";
import apiCallsImage from "../images/screenshot-5.png";
import metricsImage from "../images/screenshot-6.png";
import versionSettingsImage from "../images/screenshot-7.png";
import publicDocsImage from "../images/screenshot-8.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: seoMeta({
      title: "Open-source API docs for developers and AI agents",
      description: SITE_DESCRIPTION,
      path: "/",
    }),
    links: seoLinks({ url: siteUrl("/") }),
  }),
  loader: async ({ context }) => {
    const domainSlug = await getPublicProjectSlugFromRequest();
    if (!domainSlug) return { publicProject: null };

    try {
      const identity = await context.queryClient.ensureQueryData(
        publicDomainProjectQuery(domainSlug),
      );
      if (!identity) throw notFound();

      const queries = publicProjectQueries(
        identity.organizationSlug,
        identity.projectSlug,
      );
      const [project, navigation, guides] = await Promise.all([
        context.queryClient.ensureQueryData(queries.project),
        context.queryClient.ensureQueryData(queries.navigation),
        context.queryClient.ensureQueryData(queries.guides),
      ]);
      const firstGuide = guides.flatMap((section) => section.pages).at(0);
      if (firstGuide) {
        throw redirect({
          to: "/docs/$guideSlug",
          params: { guideSlug: firstGuide.slug },
        });
      }

      const firstEndpoint = navigation
        .flatMap((section) => section.endpoints)
        .at(0);
      if (firstEndpoint) {
        throw redirect({
          to: "/reference/$endpointSlug",
          params: { endpointSlug: firstEndpoint.slug },
        });
      }

      return { publicProject: project };
    } catch (error) {
      if (isRedirect(error)) throw error;
      throw notFound();
    }
  },
  component: Home,
});

const features = [
  {
    icon: Layers3,
    title: "Structured documentation",
    description:
      "Organize every API into projects, sections, endpoint references, and standalone guides.",
  },
  {
    icon: FileCode2,
    title: "OpenAPI import",
    description:
      "Start from OpenAPI 3.0 or 3.1 JSON and YAML, then refine the result.",
  },
  {
    icon: Bot,
    title: "AI-agent friendly",
    description:
      "Publish llms.txt, OpenAPI, Markdown exports, and read-only MCP servers so agents can browse your docs safely.",
  },
  {
    icon: GitBranch,
    title: "Documentation versioning",
    description:
      "Run draft and published versions side by side, mark betas and deprecations, and pin a default.",
  },
  {
    icon: Palette,
    title: "Custom theming",
    description:
      "Pick a theme color, brand color, font, and layout style, then add your logo and favicon.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    description:
      "Keep work inside your organization, then publish documentation deliberately.",
  },
];

const principles = [
  {
    title: "Clarity over clutter",
    description:
      "Every page exists to answer a question. Navigation, search, and layout get out of the way of the reference.",
  },
  {
    title: "Made for Writing, Not Configuring",
    description:
      "A focused editor for prose, parameters, and examples. No YAML wrangling, no templating systems to learn.",
  },
  {
    title: "Publish on Your Terms",
    description:
      "Share a project internally today, publish a public reference tomorrow. Visibility is a decision, not a migration.",
  },
  {
    title: "Open Source, Fairly Priced",
    description:
      "Start from transparent source code and avoid enterprise documentation pricing for teams that just need great docs.",
  },
];

function Home() {
  const { publicProject } = Route.useLoaderData();

  if (publicProject) {
    return (
      <main className="surface-grid flex min-h-screen items-center justify-center px-5">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-2xl">
              {publicProject.project.title}
            </CardTitle>
            <CardDescription>{publicProject.organization.name}</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            This documentation is published, but it does not have any pages yet.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-xl">
        <div className="app-container flex h-16 items-center justify-between">
          <Brand />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth/sign-up">Sign Up</Link>
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <section className="surface-grid relative overflow-hidden border-b px-5 pt-28 pb-24 sm:pt-36 sm:pb-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-border to-transparent"
        />
        <div className="mx-auto max-w-5xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-background/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-[var(--surface-raised-shadow)] backdrop-blur">
            <Sparkles className="size-3.5 text-blue-700 dark:text-blue-600" />
            Open source documentation for humans and AI agents
          </div>
          <h1 className="mx-auto mt-9 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.06em] text-foreground sm:text-7xl">
            Open-source API documentation
            <br className="hidden sm:block" />{" "}
            <span className="text-muted-foreground">developers and AI agents</span>{" "}
            <span className="relative whitespace-nowrap">
              can use
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-1 h-3 bg-blue-700/10 dark:bg-blue-600/15 blur-md"
              />
            </span>
            <span className="text-muted-foreground">.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-7 text-muted-foreground sm:text-xl sm:leading-8">
            Create, organize, import, and publish API references with OpenAPI,
            Markdown, llms.txt, and read-only MCP support without enterprise
            documentation pricing.
          </p>
        </div>
      </section>

      <section className="app-container -mt-12 pb-24 sm:-mt-16">
        <div className="overflow-hidden rounded-2xl border bg-[#090909] p-2 shadow-[var(--surface-raised-shadow)] sm:rounded-3xl sm:p-3">
          <img
            src={endpointEditorImage}
            alt="openapidoc project and endpoint editor"
            className="w-full rounded-xl bg-[#090909] sm:rounded-2xl"
          />
        </div>
      </section>

      <section className="app-container grid gap-4 pb-24 sm:gap-5 md:grid-cols-3">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="group relative overflow-hidden transition-shadow hover:shadow-[var(--surface-raised-shadow)]"
          >
            <CardHeader>
              <span className="inline-flex size-10 items-center justify-center rounded-xl border bg-muted text-muted-foreground transition-colors group-hover:border-blue-700/30 group-hover:bg-blue-700/5 group-hover:text-blue-700 dark:group-hover:border-blue-600/40 dark:group-hover:bg-blue-600/10 dark:group-hover:text-blue-400">
                <feature.icon className="size-5" />
              </span>
              <CardTitle className="mt-5 text-base tracking-[-0.01em]">
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="leading-6">
                {feature.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="border-t bg-muted/40 px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Built around the work
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              From blank project to published reference.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <FeaturePreview
              image={projectDashboardImage}
              title="Projects"
              description="Start with organized project workspaces."
            />
            <FeaturePreview
              image={endpointEditorImage}
              title="Endpoint editor"
              description="Edit paths, bodies, responses, and sections."
            />
            <FeaturePreview
              image={richEditorImage}
              title="Writing"
              description="Draft docs with a focused block editor."
            />
            <FeaturePreview
              image={navigationImage}
              title="Navigation"
              description="Build version-specific public nav links."
            />
            <FeaturePreview
              image={apiCallsImage}
              title="API calls"
              description="See request volume and failures in one place."
            />
            <FeaturePreview
              image={metricsImage}
              title="Top endpoints"
              description="Find the most-used reference URLs quickly."
            />
            <FeaturePreview
              image={versionSettingsImage}
              title="Versions"
              description="Manage default, beta, and deprecated releases."
            />
            <FeaturePreview
              image={publicDocsImage}
              title="Published docs"
              description="Show readers the reference, tester, and AI assistant."
            />
          </div>
        </div>
      </section>

      <section className="app-container py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Principles
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            A documentation tool that respects your time.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 sm:gap-8 md:grid-cols-4">
          {principles.map((principle) => (
            <div
              key={principle.title}
              className="rounded-xl border bg-card p-6 text-left shadow-[var(--surface-raised-shadow)]"
            >
              <h3 className="text-base font-semibold tracking-[-0.01em]">
                {principle.title}
              </h3>
              <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
                {principle.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t bg-muted/30 px-5 py-10">
        <div className="app-container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Brand compact />
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/license" className="hover:text-foreground">
              MIT License
            </Link>
            <a href="/sitemap.xml" className="hover:text-foreground">
              Sitemap
            </a>
            <span>&copy; 2026 openapidoc.</span>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function FeaturePreview({
  image,
  title,
  description,
}: {
  image: string;
  title: string;
  description: string;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border bg-background shadow-[var(--surface-raised-shadow)] sm:rounded-2xl">
      <div className="overflow-hidden border-b bg-muted">
        <img
          src={image}
          alt={`${title} screenshot`}
          className="aspect-[16/10] w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.1)] group-hover:scale-[1.02]"
        />
      </div>
      <div className="p-7">
        <h3 className="text-lg font-semibold tracking-[-0.02em]">{title}</h3>
        <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </article>
  );
}
