"use client";

import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFilters } from "@/lib/filters";

export const COMPARE_CAP = 4;

/** Adds or removes a project from the compare tray (URL param `compare`, max 4). */
export function CompareButton({ id, className }: { id: string; className?: string }) {
  const { state, setState } = useFilters();
  const on = state.compare.includes(id);
  const full = !on && state.compare.length >= COMPARE_CAP;
  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-7 gap-1 text-xs ${className ?? ""}`}
      disabled={full}
      title={full ? `Compare holds at most ${COMPARE_CAP} projects` : undefined}
      onClick={() => void setState({ compare: on ? state.compare.filter((x) => x !== id) : [...state.compare, id] })}
    >
      {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      {on ? "In compare" : "Add to compare"}
    </Button>
  );
}
