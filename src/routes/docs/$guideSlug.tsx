import { createFileRoute, notFound } from "@tanstack/react-router";
import { PublicDocumentation } from "../../components/public-documentation";
import {
  publicDomainProjectQuery,
  publicGuidePageQueries,
} from "../../lib/public-docs";
import { getPublicProjectSlugFromRequest } from "../../lib/public-docs-domain";
import { publicDocsUrl, seoLinks, seoMeta } from "../../lib/seo";

export const Route = createFileRoute("/docs/$guideSlug")({
  loader: async ({ params, context }) => {
    try {
      const domainSlug = await getPublicProjectSlugFromRequest();
      if (!domainSlug) throw notFound();

      const identity = await context.queryClient.ensureQueryData(
        publicDomainProjectQuery(domainSlug),
      );
      if (!identity) throw notFound();

      const queries = publicGuidePageQueries(
        identity.organizationSlug,
        identity.projectSlug,
        params.guideSlug,
      );
      const [
        project,
        navigation,
        guides,
        customNavigation,
        aiSettings,
        versions,
        guidePage,
      ] = await Promise.all([
        context.queryClient.ensureQueryData(queries.project),
        context.queryClient.ensureQueryData(queries.navigation),
        context.queryClient.ensureQueryData(queries.guides),
        context.queryClient.ensureQueryData(queries.customNavigation),
        context.queryClient.ensureQueryData(queries.aiSettings),
        context.queryClient.ensureQueryData(queries.versions),
        context.queryClient.ensureQueryData(queries.guidePage),
      ]);

      return {
        identity,
        project,
        navigation,
        guides,
        customNavigation,
        aiSettings,
        versions,
        guidePage,
      };
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    const canonicalUrl = loaderData
      ? publicDocsUrl({
          projectSlug: loaderData.project.project.slug,
          path: `/docs/${loaderData.guidePage.slug}`,
        })
      : undefined;

    return {
      meta: seoMeta({
        title: loaderData
          ? `${loaderData.guidePage.title} · ${loaderData.project.project.title}`
          : "Documentation",
        description:
          loaderData?.guidePage.description ||
          loaderData?.project.project.description ||
          "Published documentation",
        url: canonicalUrl,
        image: loaderData?.project.project.logoUrl,
        type: "article",
      }),
      links: [
        ...seoLinks({ url: canonicalUrl }),
        ...(loaderData?.project.project.faviconUrl
          ? [{ rel: "icon", href: loaderData.project.project.faviconUrl }]
          : []),
      ],
    };
  },
  component: PublicDocsGuidePageRoute,
});

function PublicDocsGuidePageRoute() {
  const data = Route.useLoaderData();
  return (
    <PublicDocumentation
      organizationSlug={data.identity.organizationSlug}
      projectSlug={data.identity.projectSlug}
      data={data}
    />
  );
}
