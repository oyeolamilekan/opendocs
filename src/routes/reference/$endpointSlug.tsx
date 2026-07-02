import { createFileRoute, notFound } from "@tanstack/react-router";
import { PublicDocumentation } from "../../components/public-documentation";
import {
  publicDomainProjectQuery,
  publicEndpointQueries,
} from "../../lib/public-docs";
import { getPublicProjectSlugFromRequest } from "../../lib/public-docs-domain";

export const Route = createFileRoute("/reference/$endpointSlug")({
  loader: async ({ params, context }) => {
    try {
      const domainSlug = await getPublicProjectSlugFromRequest();
      if (!domainSlug) throw notFound();

      const identity = await context.queryClient.ensureQueryData(
        publicDomainProjectQuery(domainSlug),
      );
      if (!identity) throw notFound();

      const queries = publicEndpointQueries(
        identity.organizationSlug,
        identity.projectSlug,
        params.endpointSlug,
      );
      const [
        project,
        navigation,
        guides,
        customNavigation,
        aiSettings,
        versions,
        endpoint,
      ] = await Promise.all([
        context.queryClient.ensureQueryData(queries.project),
        context.queryClient.ensureQueryData(queries.navigation),
        context.queryClient.ensureQueryData(queries.guides),
        context.queryClient.ensureQueryData(queries.customNavigation),
        context.queryClient.ensureQueryData(queries.aiSettings),
        context.queryClient.ensureQueryData(queries.versions),
        context.queryClient.ensureQueryData(queries.endpoint),
      ]);

      return {
        identity,
        project,
        navigation,
        guides,
        customNavigation,
        aiSettings,
        versions,
        endpoint,
      };
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.endpoint.title} · ${loaderData.project.project.title}`
          : "Documentation",
      },
      {
        name: "description",
        content:
          loaderData?.endpoint.body.description ||
          loaderData?.project.project.description ||
        "Published documentation",
      },
    ],
    links: loaderData?.project.project.faviconUrl
      ? [
          {
            rel: "icon",
            href: loaderData.project.project.faviconUrl,
          },
        ]
      : undefined,
  }),
  component: PublicEndpointRoute,
});

function PublicEndpointRoute() {
  const data = Route.useLoaderData();
  return (
    <PublicDocumentation
      organizationSlug={data.identity.organizationSlug}
      projectSlug={data.identity.projectSlug}
      data={data}
    />
  );
}
