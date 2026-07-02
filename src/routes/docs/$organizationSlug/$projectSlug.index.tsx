import {
  createFileRoute,
  isRedirect,
  notFound,
  redirect,
} from "@tanstack/react-router";
import { publicProjectQueries } from "../../../lib/public-docs";
import { getPublicDocumentationUrl } from "../../../lib/public-docs-domain";

export const Route = createFileRoute(
  "/docs/$organizationSlug/$projectSlug/",
)({
  loader: async ({ params, context }) => {
    try {
      const queries = publicProjectQueries(
        params.organizationSlug,
        params.projectSlug,
      );
      const [project, navigation, guides] = await Promise.all([
        context.queryClient.ensureQueryData(queries.project),
        context.queryClient.ensureQueryData(queries.navigation),
        context.queryClient.ensureQueryData(queries.guides),
      ]);
      const data = { project, navigation, guides };
      const firstGuidePage = data.guides
        .flatMap((section) => section.pages)
        .at(0);
      if (firstGuidePage) {
        const href = await getPublicDocumentationUrl({
          data: {
            projectSlug: params.projectSlug,
            path: `/docs/${firstGuidePage.slug}`,
          },
        });
        throw redirect({
          href,
        });
      }
      const firstEndpoint = data.navigation
        .flatMap((section) => section.endpoints)
        .at(0);
      if (firstEndpoint) {
        const href = await getPublicDocumentationUrl({
          data: {
            projectSlug: params.projectSlug,
            path: `/reference/${firstEndpoint.slug}`,
          },
        });
        throw redirect({
          href,
        });
      }
      const href = await getPublicDocumentationUrl({
        data: { projectSlug: params.projectSlug },
      });
      throw redirect({ href });
    } catch (error) {
      if (isRedirect(error)) {
        throw error;
      }
      throw notFound();
    }
  },
});
