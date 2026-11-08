"use client";

import { Segmented } from "@/components/ui/segmented";
import { METRIC_SHORT } from "@/lib/format";
import { METRICS, type MetricKey, type NumericMetricKey } from "@/lib/types";

const ALL_OPTIONS = METRICS.map((m) => ({ value: m, label: METRIC_SHORT[m] }));
const NUMERIC_OPTIONS = ALL_OPTIONS.filter((o): o is { value: NumericMetricKey; label: string } => o.value !== "count");

/**
 * The per-chart metric control (standard section 4). A chart that needs a
 * metric carries this in its card header and stores the choice under its own
 * URL key, so nothing on the page changes except that chart.
 */
export function MetricSegmented({ value, onChange, ariaLabel = "Metric" }: { value: MetricKey; onChange: (m: MetricKey) => void; ariaLabel?: string }) {
  return <Segmented value={value} onChange={onChange} options={ALL_OPTIONS} ariaLabel={ariaLabel} />;
}

/** Same control for charts that only make sense for money metrics. */
export function NumericMetricSegmented({ value, onChange, ariaLabel = "Metric" }: { value: NumericMetricKey; onChange: (m: NumericMetricKey) => void; ariaLabel?: string }) {
  return <Segmented value={value} onChange={onChange} options={NUMERIC_OPTIONS} ariaLabel={ariaLabel} />;
}
