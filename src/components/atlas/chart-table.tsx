"use client";

import { NOT_TRACKED } from "@/lib/coverage";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ChartTableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  format?: (v: unknown) => string;
}

export interface ChartTableSpec {
  columns: ChartTableColumn[];
  rows: Record<string, unknown>[];
  caption?: string;
  /** When set, a small CSV download button appears. */
  filename?: string;
  maxRows?: number;
}

export type ChartView = "chart" | "table" | "query";

function cellText(col: ChartTableColumn, v: unknown): string {
  if (col.format) return col.format(v);
  if (v === null || v === undefined) return NOT_TRACKED;
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return String(v);
}

export function chartTableToCsv(spec: ChartTableSpec): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = spec.columns.map((c) => esc(c.label)).join(",");
  const body = spec.rows.map((r) => spec.columns.map((c) => esc(cellText(c, r[c.key]))).join(",")).join("\n");
  return `﻿${head}\n${body}\n`;
}

export function ChartTable({ spec }: { spec: ChartTableSpec }) {
  const max = spec.maxRows ?? 50;
  const rows = spec.rows.slice(0, max);
  const more = spec.rows.length - rows.length;
  const download = () => {
    const blob = new Blob([chartTableToCsv(spec)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = spec.filename ?? "chart-data.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  if (spec.rows.length === 0) return <p className="text-sm text-ink-300">No rows.</p>;
  return (
    <div className="space-y-2">
      <div className="max-h-[420px] overflow-auto rounded-md border">
        <Table className="text-xs">
          {spec.caption && <caption className="sr-only">{spec.caption}</caption>}
          <TableHeader>
            <TableRow>
              {spec.columns.map((c) => (
                <TableHead key={c.key} className={cn("whitespace-nowrap", c.align === "right" && "text-right")}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                {spec.columns.map((c) => (
                  <TableCell key={c.key} className={cn(c.align === "right" ? "tabular whitespace-nowrap text-right" : "max-w-md whitespace-normal break-words")}>
                    {cellText(c, r[c.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs text-ink-300">
        <span>{more > 0 ? `Showing ${rows.length} of ${spec.rows.length} rows` : `${rows.length} rows`}</span>
        {spec.filename && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={download}>
            <Download className="size-3.5" /> CSV
          </Button>
        )}
      </div>
    </div>
  );
}

export function ChartTableToggle({ view, onChange, hasQuery }: { view: ChartView; onChange: (v: ChartView) => void; hasQuery?: boolean }) {
  const options: Array<{ value: ChartView; label: string }> = [
    { value: "chart", label: "Chart" },
    { value: "table", label: "Table" },
  ];
  if (hasQuery) options.push({ value: "query", label: "Query" });
  return <Segmented value={view} onChange={onChange} options={options} ariaLabel="View as" role="tablist" />;
}
