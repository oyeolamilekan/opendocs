import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { LogOut, Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { authClient } from "../lib/auth-client";
import { resetAuthCache } from "../lib/auth-cache";
import { RequireAuth } from "../components/auth/auth-gates";
import { Brand } from "../components/brand";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { EmptyState, LoadingState } from "../components/ui/status";
import { Field, FieldGroup } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { getErrorMessage } from "../lib/errors";
import { useToast } from "../components/ui/toast";
import { ThemeToggle } from "../components/theme-toggle";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingRoute,
});

function OnboardingRoute() {
  return (
    <RequireAuth>
      <Onboarding />
    </RequireAuth>
  );
}

function Onboarding() {
  const memberships = useQuery(api.organizations.listMine);
  const createOrganization = useMutation(api.organizations.create);
  const navigate = useNavigate();
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState("");
  const workspaceSlug = memberships?.[0]?.organization.slug;

  useEffect(() => {
    if (!workspaceSlug) return;
    void navigate({
      to: "/app/$organizationSlug/projects",
      params: { organizationSlug: workspaceSlug },
      replace: true,
    });
  }, [navigate, workspaceSlug]);

  async function openOrganization(slug: string) {
    await navigate({
      to: "/app/$organizationSlug/projects",
      params: { organizationSlug: slug },
    });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("organizationName") ?? "").trim();
    if (name.length < 2) {
      setNameError("Workspace name must be at least 2 characters");
      return;
    }

    setNameError("");
    setIsCreating(true);
    try {
      const organization = await createOrganization({ name });
      if (organization) {
        toast.success("Workspace created");
        await openOrganization(organization.slug);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to create workspace"));
    } finally {
      setIsCreating(false);
    }
  }

  async function signOut() {
    resetAuthCache();
    await authClient.signOut();
    await navigate({ to: "/", replace: true });
  }

  return (
    <main className="min-h-screen px-5 py-7 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={signOut}>
              <LogOut data-icon="inline-start" />
              Sign Out
            </Button>
          </div>
        </header>

        <div className="mt-14">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Workspace setup
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
            Create your workspace
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Your projects, documentation, and team access live here.
          </p>
        </div>

        {memberships === undefined ? (
          <LoadingState label="Loading workspace" />
        ) : memberships.length > 0 ? (
          <LoadingState label="Opening workspace" />
        ) : (
          <Card className="mt-9 p-6 sm:p-8">
            <EmptyState
              title="Name Your Workspace"
              description="You only need one workspace for your projects and team."
              action={
                <form
                  onSubmit={handleCreate}
                  className="mx-auto max-w-md text-left"
                >
                  <FieldGroup className="gap-3">
                    <Field
                      label="Workspace name"
                      htmlFor="organizationName"
                      error={nameError}
                    >
                      <Input
                        id="organizationName"
                        name="organizationName"
                        placeholder="Acme Engineering"
                        autoFocus
                        aria-invalid={Boolean(nameError)}
                      />
                    </Field>
                    <Button type="submit" disabled={isCreating}>
                      <Plus data-icon="inline-start" />
                       {isCreating ? "Creating Workspace..." : "Create Workspace"}
                    </Button>
                  </FieldGroup>
                </form>
              }
            />
          </Card>
        )}
      </div>
    </main>
  );
}
