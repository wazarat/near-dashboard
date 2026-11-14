import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ResultRow } from "@/lib/thesis-types";
import { TestStatusBadge } from "./test-status";

/** Every pre-registered test in one table at the top of /thesis, each row linking to its card. */
export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border" data-testid="thesis-results-table">
      <Table className="text-xs">
        <caption className="sr-only">Pre-registered tests and their results</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Test</TableHead>
            <TableHead className="min-w-[220px]">Pre-registered rule</TableHead>
            <TableHead className="min-w-[220px]">Result</TableHead>
            <TableHead className="whitespace-nowrap">Outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="min-w-[160px] whitespace-normal align-top">
                <a href={`#test-${r.id}`} className="font-medium text-ink-50 underline-offset-2 hover:underline">
                  {r.code} · {r.test}
                </a>
              </TableCell>
              <TableCell className="whitespace-normal align-top text-ink-300">{r.rule}</TableCell>
              <TableCell className="whitespace-normal align-top">{r.result}</TableCell>
              <TableCell className="align-top">
                <TestStatusBadge status={r.status} className="text-xs" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
