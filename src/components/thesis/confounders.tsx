import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EVENT_COLOR } from "@/lib/colors";
import { fmtEventDate } from "@/lib/format";
import type { Confounder } from "@/lib/thesis-types";
import type { EventType } from "@/lib/types";

function kindColor(kind: string): string {
  return (EVENT_COLOR as Record<string, string>)[kind as EventType] ?? "var(--mute-1)";
}

export function Confounders({ items }: { items: Confounder[] }) {
  const sorted = [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="gap-1 px-4">
        <h3 className="text-sm font-semibold leading-tight">Confounders reported honestly</h3>
        <p className="text-xs text-ink-300">
          {items.length} dated events inside the window that move Intents volume or price for reasons unrelated to NEAR usage. Dates and sources come from the ecosystem events file.
        </p>
      </CardHeader>
      <CardContent className="px-4">
        {sorted.length === 0 ? (
          <p className="text-sm text-ink-300">No confounders recorded.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {sorted.map((c) => (
              <li key={`${c.date}-${c.title}`} className="flex flex-col gap-1.5 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-300">
                  <time dateTime={c.date} className="tabular">
                    {fmtEventDate(c.date, c.monthOnly)}
                  </time>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-label text-ink-50">
                    <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: kindColor(c.kind) }} />
                    {c.kind}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug">{c.title}</p>
                <p className="text-xs leading-relaxed text-ink-300">
                  <span className="font-medium text-foreground">Why it matters. </span>
                  {c.why}
                </p>
                {c.detail && <p className="text-[11px] leading-relaxed text-ink-300">{c.detail}</p>}
                {c.sourceUrl && (
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex w-fit items-center gap-1 rounded-sm text-xs text-ink-300 underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Source <ExternalLink aria-hidden="true" className="size-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
