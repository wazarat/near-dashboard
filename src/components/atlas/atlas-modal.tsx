"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The detail modal every Atlas page uses for a project, a sector or an investor
 * (docs/ATLAS-UI.md, section 3). Centred and about 960px wide on desktop,
 * a full-screen sheet on phones. Radix gives the focus trap, the scroll lock
 * and Esc or backdrop close; the caller keeps the open state in the URL.
 */
export function AtlasModal({ open, onOpenChange, children, testId, width = "wide", className }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode; testId?: string; width?: "wide" | "narrow"; className?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid={testId}
        className={cn(
          "flex h-dvh w-screen max-w-none flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-none sm:rounded-2xl",
          width === "wide" ? "sm:w-[min(960px,calc(100vw-2rem))]" : "sm:w-[min(720px,calc(100vw-2rem))]",
          className,
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pt-5 sm:p-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
