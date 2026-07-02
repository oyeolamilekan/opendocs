import type { ReactNode } from "react";
import { Brand } from "../brand";
import { Card } from "../ui/card";
import { ThemeToggle } from "../theme-toggle";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="surface-grid min-h-screen px-5 py-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-md flex-col">
        <div className="mb-8 flex items-center justify-between">
          <Brand />
          <ThemeToggle />
        </div>
        <Card className="p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <div className="mt-7">{children}</div>
        </Card>
      </div>
    </main>
  );
}
