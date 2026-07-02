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

export const Route = createFileRoute("/reference/")({
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
      const navigation = await context.queryClient.ensureQueryData(
        queries.navigation,
      );
      const firstEndpoint = navigation
        .flatMap((section) => section.endpoints)
        .at(0);

      if (!firstEndpoint) throw notFound();
      throw redirect({
        to: "/reference/$endpointSlug",
        params: { endpointSlug: firstEndpoint.slug },
      });
    } catch (error) {
      if (isRedirect(error)) throw error;
      throw notFound();
    }
  },
});
