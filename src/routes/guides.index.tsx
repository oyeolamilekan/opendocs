import {
  createFileRoute,
  isRedirect,
  notFound,
  redirect,
} from "@tanstack/react-router";
import {
  publicDomainProjectQuery,
  publicProjectQueries,
} from "../lib/public-docs";
import { getPublicProjectSlugFromRequest } from "../lib/public-docs-domain";

export const Route = createFileRoute("/guides/")({
  loader: async ({ context }) => {
    try {
      const domainSlug = await getPublicProjectSlugFromRequest();
      if (!domainSlug) throw notFound();

      const identity = await context.queryClient.ensureQueryData(
        publicDomainProjectQuery(domainSlug),
      );
      if (!identity) throw notFound();

      const queries = publicProjectQueries(
        identity.organizationSlug,
        identity.projectSlug,
      );
      const guides = await context.queryClient.ensureQueryData(queries.guides);
      const firstGuide = guides.flatMap((section) => section.pages).at(0);

      if (!firstGuide) throw notFound();
      throw redirect({
        to: "/docs/$guideSlug",
        params: { guideSlug: firstGuide.slug },
      });
    } catch (error) {
      if (isRedirect(error)) throw error;
      throw notFound();
    }
  },
});
