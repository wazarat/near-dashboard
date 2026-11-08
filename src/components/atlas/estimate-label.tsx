import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Marks a figure as an estimate with a short explanation on hover. */
export function EstimateLabel({ children, note }: { children: React.ReactNode; note: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help rounded border px-1 text-[10px] leading-4 text-muted-foreground" aria-label={note}>
            est.
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{note}</TooltipContent>
      </Tooltip>
    </span>
  );
}
