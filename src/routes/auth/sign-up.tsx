import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "../../lib/auth-client";
import { resetAuthCache } from "../../lib/auth-cache";
import { getErrorMessage } from "../../lib/errors";
import { AuthShell } from "../../components/auth/auth-shell";
import { RequireGuest } from "../../components/auth/auth-gates";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Field, FieldGroup } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { seoMeta } from "../../lib/seo";

export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({
    meta: seoMeta({
      title: "Create Account",
      description: "Create an openapidoc workspace.",
      path: "/auth/sign-up",
      noindex: true,
    }),
  }),
  component: SignUpRoute,
});

function SignUpRoute() {
  return (
    <RequireGuest>
      <SignUp />
    </RequireGuest>
  );
}

function SignUp() {
  const navigate = useNavigate();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(data.get("password") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    const acceptedTerms = data.get("terms") === "on";
    const nextErrors: Record<string, string> = {};

    if (name.length < 2) nextErrors.name = "Enter your full name";
    if (!email) nextErrors.email = "Email is required";
    if (password.length < 12) {
      nextErrors.password = "Password must be at least 12 characters";
    }
    if (password !== confirmation) {
      nextErrors.confirmation = "Passwords do not match";
    }
    if (!acceptedTerms) nextErrors.terms = "Accept the terms to continue";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const result = await authClient.signUp.email({ name, email, password });
    setIsSubmitting(false);

    if (result.error) {
      toast.error(getErrorMessage(result.error, "Unable to create account"));
      return;
    }

    resetAuthCache();
    toast.success("Your account is ready");
    await navigate({ to: "/onboarding", replace: true });
  }

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Start a Documentation Workspace"
      description="Create one workspace for your projects and team."
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field label="Full name" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              aria-invalid={Boolean(errors.name)}
            />
          </Field>
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
          <Field
            label="Password"
            htmlFor="password"
            error={errors.password}
            hint="12 characters minimum"
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a strong password"
              aria-invalid={Boolean(errors.password)}
            />
          </Field>
          <Field
            label="Confirm password"
            htmlFor="confirmation"
            error={errors.confirmation}
          >
            <Input
              id="confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              aria-invalid={Boolean(errors.confirmation)}
            />
          </Field>
          <Field label="Terms" htmlFor="terms" error={errors.terms}>
            <label className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3.5 text-sm text-muted-foreground">
              <Checkbox
                id="terms"
                name="terms"
                value="on"
                className="mt-0.5"
                aria-invalid={Boolean(errors.terms)}
              />
              <span>
                I agree to the{" "}
                <Link
                  to="/auth/terms"
                  className="font-semibold text-foreground underline underline-offset-4"
                >
                  terms of service
                </Link>
                .
              </span>
            </label>
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating Account..." : "Create Account"}
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/auth/sign-in"
          className="font-semibold text-foreground underline underline-offset-4"
        >
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
