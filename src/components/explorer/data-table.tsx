"use client";

import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type PaginationState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/atlas/chart-card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

export const tableFeaturesConfig = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

export type Features = typeof tableFeaturesConfig;

/** Per-column presentation hints read by DataTable. */
export interface ColumnMeta {
  align?: "right";
  hideBelow?: "sm" | "md" | "lg";
  estimate?: boolean;
}

export function makeColumnHelper<T extends RowData>() {
  return createColumnHelper<Features, T>();
}
export const projectColumnHelper = makeColumnHelper<Project>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyColumnDef<T extends RowData> = ColumnDef<Features, T, any>;
export type ProjectColumnDef = AnyColumnDef<Project>;

const HIDE: Record<NonNullable<ColumnMeta["hideBelow"]>, string> = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

interface Props<T extends RowData> {
  data: T[];
  columns: AnyColumnDef<T>[];
  initialSorting?: SortingState;
  initialVisibility?: ColumnVisibilityState;
  pageSize?: number;
  chooser?: boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  getRowId?: (row: T, index: number) => string;
  toolbar?: React.ReactNode;
  emptyMessage?: string;
  dense?: boolean;
  footer?: React.ReactNode;
  /** The table's own count line, "Showing X of N rounds" (standard section 9). X is the rows in the table, N the rows before the table's own filters. */
  showing?: { total: number; noun: string };
}

/** The count of a table of records. It sits with the table, never in its title, and follows the table's filters. */
export function ShowingLine({ shown, total, noun, className }: { shown: number; total: number; noun: string; className?: string }) {
  return (
    <p className={cn("text-xs text-ink-300", className)} aria-live="polite" data-testid="showing-line">
      Showing <span className="tabular font-medium text-ink-50">{shown.toLocaleString("en-US")}</span> of {total.toLocaleString("en-US")} {noun}
    </p>
  );
}

export function DataTable<T extends RowData>({ data, columns, initialSorting = [], initialVisibility = {}, pageSize = 25, chooser = false, onRowClick, rowClassName, getRowId, toolbar, emptyMessage, dense, footer, showing }: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(initialVisibility);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });

  const table = useTable({
    features: tableFeaturesConfig,
    columns,
    data,
    getRowId,
    state: { sorting, columnVisibility, pagination },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    autoResetPageIndex: true,
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const { pageIndex } = table.state.pagination;
  const from = data.length === 0 ? 0 : pageIndex * table.state.pagination.pageSize + 1;
  const to = Math.min(data.length, (pageIndex + 1) * table.state.pagination.pageSize);
  const metaOf = (def: { meta?: unknown }) => (def.meta ?? {}) as ColumnMeta;

  return (
    <div className="space-y-2">
      {(chooser || toolbar || showing) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {toolbar}
            {showing && <ShowingLine shown={data.length} total={showing.total} noun={showing.noun} />}
          </div>
          {chooser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Columns3 className="size-3.5" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
                <DropdownMenuLabel className="text-xs">Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table.getAllLeafColumns().map((col) => (
                  <DropdownMenuCheckboxItem key={col.id} checked={col.getIsVisible()} onCheckedChange={(v) => col.toggleVisibility(Boolean(v))} onSelect={(e) => e.preventDefault()} className="text-xs">
                    {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      {data.length === 0 ? (
        <div className="px-4">
          <EmptyState message={emptyMessage} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className={cn(dense && "text-xs")}>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header, i) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    const m = metaOf(header.column.columnDef);
                    return (
                      <TableHead
                        key={header.id}
                        className={cn("whitespace-nowrap", i === 0 && "pl-4", i === hg.headers.length - 1 && "pr-4", m.align === "right" && "text-right", m.hideBelow && HIDE[m.hideBelow])}
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn("inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", m.align === "right" && "flex-row-reverse")}
                          >
                            <table.FlexRender header={header} />
                            {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} onClick={onRowClick ? () => onRowClick(row.original) : undefined} className={cn(onRowClick && "cursor-pointer", rowClassName?.(row.original))}>
                  {row.getVisibleCells().map((cell, i, arr) => {
                    const m = metaOf(cell.column.columnDef);
                    return (
                      <TableCell key={cell.id} className={cn("align-top", i === 0 && "pl-4", i === arr.length - 1 && "pr-4", m.align === "right" && "tabular text-right", m.hideBelow && HIDE[m.hideBelow])}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {footer && <div className="px-4 text-xs text-ink-300">{footer}</div>}
      {data.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 px-4 text-xs text-ink-300">
          <span>
            {from}–{to} of {data.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-7" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="tabular px-1">
              {pageIndex + 1} / {pageCount}
            </span>
            <Button variant="outline" size="icon" className="size-7" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
