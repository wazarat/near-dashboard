"use client";

import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPARE_MAX, useCompare } from "@/lib/compare";

export const COMPARE_CAP = COMPARE_MAX;

/**
 * Adds or removes a project from the compare tray (URL param `compare`, max 4). It goes through
 * useCompare, so adding while logged out opens the login pop-up and finishes after sign-in.
 */
export function CompareButton({ id, className }: { id: string; className?: string }) {
  const { has, toggle, isFull } = useCompare();
  const on = has(id);
  const full = !on && isFull;
  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-7 gap-1 text-xs ${className ?? ""}`}
      disabled={full}
      title={full ? `Compare holds at most ${COMPARE_CAP} projects` : undefined}
      onClick={() => toggle(id)}
      data-testid="compare-button"
    >
      {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      {on ? "In compare" : "Add to compare"}
    </Button>
  );
}
