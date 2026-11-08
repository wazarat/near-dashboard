"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label?: string;
  count?: number;
  color?: string;
  hint?: string;
}

interface Props {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
  searchable?: boolean;
}

export function MultiSelect({ label, options, selected, onChange, className, searchable = true }: Props) {
  const [open, setOpen] = useState(false);
  const n = selected.length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={`${label} filter${n ? `, ${n} selected` : ""}`}
          className={cn("h-8 justify-between gap-1.5 px-2.5 text-xs font-normal", n > 0 && "border-foreground/40", className)}
        >
          <span className="truncate">
            {label}
            {n > 0 && <span className="ml-1.5 rounded bg-foreground px-1.5 py-px text-[10px] font-semibold text-background">{n}</span>}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder={`Search ${label.toLowerCase()}…`} className="h-9 text-xs" />}
          <CommandList className="max-h-72">
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={o.label ?? o.value}
                    onSelect={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                    className="gap-2 text-xs"
                    title={o.hint}
                  >
                    <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-sm border", on ? "border-foreground bg-foreground text-background" : "border-input")} aria-hidden="true">
                      {on && <Check className="size-3" />}
                    </span>
                    {o.color && <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: o.color }} />}
                    <span className="flex-1 truncate">{o.label ?? o.value}</span>
                    {o.count !== undefined && <span className="tabular text-muted-foreground">{o.count}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {n > 0 && (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="h-7 w-full justify-start gap-1 text-xs" onClick={() => onChange([])}>
                <X className="size-3" /> Clear {label.toLowerCase()}
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
