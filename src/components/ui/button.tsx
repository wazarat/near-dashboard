import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Flat buttons from the CanHav design system: one electric fill for the
 * primary action (one per view), bordered ink surfaces for the rest,
 * radius-lg like the inputs. No gradients, no glow.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-electric-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-electric-500 text-on-electric hover:bg-electric-400",
        secondary: "border-ink-700/60 bg-ink-900 text-ink-50 hover:bg-ink-800/60",
        outline: "border-ink-700/60 text-ink-50 hover:border-ink-500 hover:bg-ink-800/40 aria-expanded:bg-ink-800/40",
        ghost: "text-ink-300 hover:bg-ink-800/60 hover:text-ink-50 aria-expanded:bg-ink-800/60 aria-expanded:text-ink-50",
        destructive: "border-ink-700/60 text-rose-400 hover:bg-ink-800/60",
        link: "text-electric-400 underline-offset-4 hover:text-electric-200 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 text-sm",
        xs: "h-6 gap-1 rounded-md px-2 text-label [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 px-2.5 text-label [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-4 text-sm",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
