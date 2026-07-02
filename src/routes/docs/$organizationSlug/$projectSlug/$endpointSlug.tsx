import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPublicDocumentationUrl } from "../../../../lib/public-docs-domain";

export const Route = createFileRoute(
  "/docs/$organizationSlug/$projectSlug/$endpointSlug",
)({
  loader: async ({ params }) => {
    const href = await getPublicDocumentationUrl({
      data: {
        projectSlug: params.projectSlug,
        path: `/reference/${params.endpointSlug}`,
      },
    });
    throw redirect({ href });
  },
});
