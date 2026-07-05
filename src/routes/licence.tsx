import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/licence")({
  loader: () => {
    throw redirect({ to: "/license" });
  },
});
