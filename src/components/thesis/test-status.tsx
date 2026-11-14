import { CircleCheck, CircleHelp, CircleMinus, OctagonAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestStatus } from "@/lib/thesis-tests";

const META: Record<TestStatus, { label: string; className: string; Icon: LucideIcon }> = {
  pass: { label: "Pass", className: "text-signal-400", Icon: CircleCheck },
  fail: { label: "Fail", className: "text-rose-400", Icon: OctagonAlert },
  inconclusive: { label: "Inconclusive", className: "text-ink-50", Icon: CircleHelp },
  "not computed": { label: "Could not compute", className: "text-ink-300", Icon: CircleMinus },
};

/** A pre-registered test's outcome as a word with an outline icon. */
export function TestStatusBadge({ status, className }: { status: TestStatus; className?: string }) {
  const m = META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold", m.className, className)} data-status={status}>
      <m.Icon aria-hidden="true" className="size-4 shrink-0" />
      {m.label}
    </span>
  );
}

/** The pass or fail line under a test card. the outcome, then the rule it was judged by. */
export function TestStatusLine({ status, rule }: { status: TestStatus; rule: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border px-3 py-2 sm:flex-row sm:items-start sm:gap-3" data-testid="test-status-line">
      <TestStatusBadge status={status} />
      <p className="text-xs text-ink-300">{rule}</p>
    </div>
  );
}
