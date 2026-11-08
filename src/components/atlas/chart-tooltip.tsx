import type { ReactNode } from "react";

export function TooltipFrame({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="max-w-xs rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function TooltipRow({ label, value, color }: { label: ReactNode; value: ReactNode; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {color && <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />}
        {label}
      </span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}

/** Loose shape of what Recharts hands a custom tooltip content. */
export interface TipProps<T = unknown> {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ payload: T; value?: number | string; name?: string | number; dataKey?: string | number; color?: string }>;
}
