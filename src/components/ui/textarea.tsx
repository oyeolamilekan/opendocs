import * as React from "react"

import { cn } from "#/lib/utils.ts"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-24 w-full resize-y rounded-sm border border-input bg-background px-3 py-2.5 text-base outline-none transition-colors duration-150 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground md:text-sm",
        "focus-visible:border-ring focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
