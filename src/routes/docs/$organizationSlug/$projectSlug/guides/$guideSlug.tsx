import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPublicDocumentationUrl } from "../../../../../lib/public-docs-domain";

export const Route = createFileRoute(
  "/docs/$organizationSlug/$projectSlug/guides/$guideSlug",
)({
  loader: async ({ params }) => {
    const href = await getPublicDocumentationUrl({
      data: {
        projectSlug: params.projectSlug,
        path: `/docs/${params.guideSlug}`,
      },
    });
    throw redirect({ href });
  },
});
