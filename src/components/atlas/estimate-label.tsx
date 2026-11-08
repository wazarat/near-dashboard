import { InfoTip } from "@/components/ui/info-tip";

/** Marks a figure as an estimate: plain mono "est." after the label, with the reason behind an InfoTip. */
export function EstimateLabel({ children, note }: { children: React.ReactNode; note: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <span className="font-mono text-label text-ink-500">est.</span>
      <InfoTip label="Why this is an estimate">{note}</InfoTip>
    </span>
  );
}
