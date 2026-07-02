import * as React from "react"

import { cn } from "#/lib/utils.ts"

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(function Input({ className, type, ...props }, ref) {
  return (
    <input
      type={type}
      data-slot="input"
      ref={ref}
      className={cn(
        "h-10 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-2 text-base outline-none transition-colors duration-150 selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground md:text-sm",
        "focus-visible:ring-3 focus-visible:ring-ring/20",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
})

export { Input }
