import * as React from "react"

import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-white/80 bg-white/65 px-4 py-2 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_24px_-22px_rgba(15,23,42,0.5)] backdrop-blur-xl ring-offset-background transition-[background-color,border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.09] dark:bg-white/[0.045] dark:focus-visible:bg-white/[0.07] md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
