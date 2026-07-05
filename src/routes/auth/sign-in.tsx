import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "../../lib/auth-client";
import { resetAuthCache } from "../../lib/auth-cache";
import { getErrorMessage } from "../../lib/errors";
import { AuthShell } from "../../components/auth/auth-shell";
import { RequireGuest } from "../../components/auth/auth-gates";
import { Button } from "../../components/ui/button";
import { Field, FieldGroup } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { seoMeta } from "../../lib/seo";

export const Route = createFileRoute("/auth/sign-in")({
  head: () => ({
    meta: seoMeta({
      title: "Sign In",
      description: "Sign in to your openapidoc workspace.",
      path: "/auth/sign-in",
      noindex: true,
    }),
  }),
  component: SignInRoute,
});

function SignInRoute() {
  return (
    <RequireGuest>
      <SignIn />
    </RequireGuest>
  );
}

function SignIn() {
  const navigate = useNavigate();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    const nextErrors: Record<string, string> = {};

    if (!email) nextErrors.email = "Email is required";
    if (!password) nextErrors.password = "Password is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const result = await authClient.signIn.email({ email, password });
    setIsSubmitting(false);

    if (result.error) {
      toast.error(getErrorMessage(result.error, "Unable to sign in"));
      return;
    }

    resetAuthCache();
    toast.success("Welcome back");
    await navigate({ to: "/onboarding", replace: true });
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign In to Your Workspace"
      description="Your session is stored in a secure HttpOnly cookie."
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field label="Email address" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={Boolean(errors.email)}
            />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password}>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              aria-invalid={Boolean(errors.password)}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing In..." : "Sign In"}
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to openapidoc?{" "}
        <Link
          to="/auth/sign-up"
          className="font-semibold text-foreground underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
