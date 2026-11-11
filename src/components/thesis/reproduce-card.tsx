import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { THESIS_MD_URL } from "./palette";

const STEPS = [
  { cmd: "npm run rebuild", note: "recomputes every chart, table, thesis.json and THESIS.md from the committed raw data; no network, no secrets" },
  { cmd: "npm run refresh", note: "refetches the raw data first (DefiLlama, NearBlocks and NEAR Catalog need no keys; BigQuery needs GCP_PROJECT_ID with Application Default Credentials; the Intents Explorer needs NEAR_INTENTS_JWT)" },
];

export function ReproduceCard() {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="gap-1 px-4">
        <h3 className="text-sm font-semibold leading-tight">Reproduce</h3>
        <p className="text-xs text-ink-300">
          THESIS.md and this page are generated from the same <code className="rounded bg-muted px-1 font-mono text-[11px]">thesis.json</code>; every chart above carries its SQL, API call and transform under the Query tab.
        </p>
      </CardHeader>
      <CardContent className="px-4">
        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li key={s.cmd} className="space-y-1">
              <pre className="overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                <code>{s.cmd}</code>
              </pre>
              <p className="text-xs text-ink-300">{s.note}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-ink-300">
          <a
            href={THESIS_MD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Read THESIS.md <ExternalLink aria-hidden="true" className="size-3" />
          </a>{" "}
          for the same results as Markdown.
        </p>
      </CardContent>
    </Card>
  );
}
