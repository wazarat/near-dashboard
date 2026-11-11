import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The card from the CanHav design system: an ink-900 surface with a hairline
 * ink-700 border at 60% and radius-xl, lit from the top edge like the Studio
 * cards on canhav.com (`card-lit` in globals.css).
 * `CardSection` stacks blocks inside one card with a 40% divider between them.
 */
function Card({ className, size = "default", ...props }: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card card-lit flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl border border-ink-700/60 bg-card py-(--card-spacing) text-sm text-card-foreground [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 data-[size=sm]:[--card-spacing:--spacing(3)]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("font-display text-sm font-semibold leading-tight text-ink-50", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-sm text-ink-300", className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center border-t border-ink-700/40 p-(--card-spacing)", className)} {...props} />;
}

/** A block inside a card with a soft divider above it; the first one has none. */
function CardSection({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-section" className={cn("border-t border-ink-700/40 px-(--card-spacing) pt-(--card-spacing) first:border-t-0 first:pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent, CardSection };
