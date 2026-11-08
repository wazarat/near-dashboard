"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { availablePresets, COMPARE_MAX } from "@/lib/compare";
import { fmtMetric } from "@/lib/format";
import type { MetricKey, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AddProps {
  /** Every project the reader can pick from. */
  all: Project[];
  exclude: string[];
  onAdd: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Searchable picker; projects with traction sort first so the obvious ones are a keystroke away. */
export function AddProjectPopover({ all, exclude, onAdd, disabled, className }: AddProps) {
  const [open, setOpen] = useState(false);
  const candidates = useMemo(() => {
    const out = all.filter((p) => !exclude.includes(p.id));
    out.sort((a, b) => Number(b.hasTraction) - Number(a.hasTraction) || a.name.localeCompare(b.name));
    return out;
  }, [all, exclude]);
  const full = Boolean(disabled);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 gap-1 text-xs", className)} disabled={full} title={full ? `Compare holds at most ${COMPARE_MAX} projects` : undefined} aria-label="Add a project to compare">
          <Plus className="size-3.5" /> Add project
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects by name" className="text-sm" />
          <CommandList className="max-h-64">
            <CommandEmpty>No project matches.</CommandEmpty>
            <CommandGroup>
              {candidates.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  keywords={[p.sector]}
                  onSelect={() => {
                    onAdd(p.id);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="ml-auto truncate pl-2 text-muted-foreground">{p.sector}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Named sets resolved by exact project name; presets with fewer than two matches are hidden. */
export function PresetChips({ all, onApply, className }: { all: Project[]; onApply: (ids: string[]) => void; className?: string }) {
  const presets = useMemo(() => availablePresets(all), [all]);
  if (presets.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-xs text-muted-foreground">Presets</span>
      {presets.map((p) => (
        <button key={p.name} type="button" onClick={() => onApply(p.ids)} className="rounded-md border px-2 py-0.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={p.names.join(", ")}>
          {p.name} <span className="text-muted-foreground">({p.ids.length})</span>
        </button>
      ))}
    </div>
  );
}

/** Quick-start buttons for the largest projects by the current metric. */
export function TopProjectButtons({ projects, metric, onAdd }: { projects: Project[]; metric: MetricKey; onAdd: (id: string) => void }) {
  if (projects.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {projects.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => onAdd(p.id)} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Add ${p.name} to compare`}>
            <Plus className="size-3 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{p.name}</span>
            {metric !== "count" && <span className="tabular text-muted-foreground">{fmtMetric(metric, p[metric])}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
