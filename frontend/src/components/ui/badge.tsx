import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/10 text-white",
        success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
        danger: "border-red-400/25 bg-red-400/10 text-red-300",
        warning: "border-amber-400/25 bg-amber-400/10 text-amber-300",
        outline: "border-white/15 text-white/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
