import * as React from "react"

import { cn } from "#/lib/utils.ts"

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex w-full flex-col gap-5", className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2 text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      className={cn("text-sm font-normal text-destructive", className)}
      role="alert"
      {...props}
    />
  )
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="field"
      data-invalid={error ? true : undefined}
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex items-baseline justify-between gap-4">
        <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  )
}

export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel }
