import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-blue-600 text-white",
        secondary: "border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
        destructive: "border-transparent bg-red-500 text-white",
        outline: "border-[hsl(var(--border))] text-[hsl(var(--foreground))]",
        success: "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        warning: "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400",
        info: "border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400",
        matched: "border-transparent bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30",
        missing: "border-transparent bg-red-500/20 text-red-700 dark:text-red-300 ring-1 ring-red-500/30",
        recommended: "border-transparent bg-blue-500/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30",
        free: "border-transparent bg-green-500/20 text-green-700 dark:text-green-300",
        paid: "border-transparent bg-purple-500/20 text-purple-700 dark:text-purple-300",
        certification: "border-transparent bg-amber-500/20 text-amber-700 dark:text-amber-300",
        practice: "border-transparent bg-teal-500/20 text-teal-700 dark:text-teal-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
