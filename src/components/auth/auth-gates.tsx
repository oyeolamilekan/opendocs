import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ensureProfileCached } from "../../lib/auth-cache";
import { LoadingState } from "../ui/status";

export function RequireGuest({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate({ to: "/onboarding", replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || isAuthenticated) {
    return <LoadingScreen label="Checking your session" />;
  }

  return children;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: "/auth/sign-in", replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated) {
    return <LoadingScreen label="Loading your account" />;
  }

  return <ProfileBootstrap>{children}</ProfileBootstrap>;
}

function ProfileBootstrap({ children }: { children: ReactNode }) {
  const ensureProfile = useMutation(api.users.ensureCurrentProfile);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    void ensureProfileCached(ensureProfile)
      .then(() => {
        if (active) setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [ensureProfile]);

  if (status === "loading") {
    return <LoadingScreen label="Preparing your workspace" />;
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">We could not prepare your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Refresh the page to retry profile provisioning.
          </p>
        </div>
      </main>
    );
  }

  return children;
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <LoadingState label={label} />
    </main>
  );
}
