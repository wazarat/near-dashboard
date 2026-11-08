import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** Short line under the title saying where the items come from. */
  note?: string;
  items: string[];
  icon?: LucideIcon;
  iconColor?: string;
  emptyMessage?: string;
  className?: string;
}

/** Verbatim bullet list from thesis.json (evidence, what would change my mind, data gaps). */
export function TextListCard({ title, note, items, icon: Icon, iconColor, emptyMessage = "Nothing recorded.", className }: Props) {
  return (
    <Card className={cn("gap-3 py-4", className)}>
      <CardHeader className="gap-1 px-4">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" style={{ color: iconColor }} />}
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        </div>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardHeader>
      <CardContent className="px-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
