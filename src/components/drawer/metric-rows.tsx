"use client";

import type { ReactNode } from "react";
import { ChangeCell } from "@/components/atlas/change-cell";
import { InfoTip } from "@/components/ui/info-tip";
import { fmtDate, fmtUsd } from "@/lib/format";
import { isStale } from "@/lib/freshness";
import { CROSS_SECTOR_FACTS, fmtMetricValue, INFLATED_HOLDERS, INFLATED_HOLDERS_NOTE, METRIC_DEFS, metricLabel, projectMetrics, sectorDef, type MetricValue, revenueFromIntents } from "@/lib/sector-metrics";
import type { MetricSource, NumericMetricKey, Project } from "@/lib/types";

const DAILY = new Set<string>(["tvl", "volume", "fees", "revenue"]);

function Row({ label, info, children }: { label: string; info: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-0.5 text-sm" data-testid="metric-row">
      <dt className="inline-flex items-start gap-1 text-ink-300">
        <span>{label}</span>
        <InfoTip label={`About ${label}`}>{info}</InfoTip>
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function fmt(m: MetricValue): string {
  return fmtMetricValue(m.id, m.value as number, true);
}

/** Where a value came from and how old it is: daily figures carry their 30-day change; a snapshot value older than three days shows its date (accuracy rule 4). */
function Provenance({ p, m }: { p: Project; m: MetricValue }) {
  if (DAILY.has(m.id)) {
    const k = m.id as NumericMetricKey;
    const s: MetricSource = p.metricSource?.[k] ?? "none";
    if (s === "none") return null;
    const change = p.live?.change[k].d30;
    return (
      <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-ink-300">
        {s === "live" ? "daily" : `snapshot ${fmtDate(p.snapshot.asOf)}`}
        {s === "live" && change !== null && change !== undefined && (
          <>
            · 30d <ChangeCell value={change} />
          </>
        )}
      </span>
    );
  }
  const asOf = p.extra?.asOf[m.id];
  if (!asOf) return null;
  return <span className="ml-2 text-xs text-ink-300">{isStale(asOf) ? `as of ${fmtDate(asOf)}` : p.extra?.from[m.id] === "snapshot" ? "snapshot" : "daily"}</span>;
}

function Value({ p, m }: { p: Project; m: MetricValue }) {
  switch (m.state) {
    case "value":
      return (
        <>
          <span className="tabular">{fmt(m)}</span>
          <Provenance p={p} m={m} />
          {m.id === "revenue" && revenueFromIntents(p) && <span className="ml-2 text-xs text-ink-300">from NEAR Intents app fees</span>}
          {m.id === "tokenHolders" && INFLATED_HOLDERS.has(p.id) && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-300">
              mostly app-created accounts
              <InfoTip label="Why holders are inflated">{INFLATED_HOLDERS_NOTE}</InfoTip>
            </span>
          )}
          {m.id === "tvl" && (p.tvlNear !== null || p.tvlAurora !== null) && p.tvlNear !== p.tvl && (
            <span className="ml-2 text-xs text-ink-300">
              NEAR {fmtUsd(p.tvlNear)} · Aurora {fmtUsd(p.tvlAurora)}
            </span>
          )}
        </>
      );
    case "zero-by-design":
      return (
        <span className="inline-flex items-center gap-1">
          <span className="tabular">{METRIC_DEFS[m.id].unit === "usd" ? "$0" : METRIC_DEFS[m.id].unit === "pct" ? "0%" : "0"}</span>
          <InfoTip label={`Why ${METRIC_DEFS[m.id].label} is zero`}>{m.reason}</InfoTip>
        </span>
      );
    case "inactive":
      return (
        <span className="text-ink-300">
          {m.value === null ? "none recorded" : <span className="tabular">{fmt(m)}</span>}
          <span className="ml-2 text-xs">last value, project {p.statusGroup.toLowerCase()}</span>
        </span>
      );
    default:
      return null;
  }
}

/**
 * The project's metrics from the sector registry (src/lib/sector-metrics.ts), headline first. A metric that does
 * not apply to the sector, or that no source covers yet, is not listed.
 */
export function MetricRows({ p }: { p: Project }) {
  const def = sectorDef(p.sector);
  const rows = projectMetrics(p).filter((m) => m.state !== "not-applicable" && m.state !== "not-tracked");
  // Facts any project can carry (NEAR Intents routing), shown only when a value exists.
  for (const id of CROSS_SECTOR_FACTS) {
    const v = p.extra?.values[id];
    if (v !== undefined && !rows.some((r) => r.id === id)) rows.push({ id, state: "value", value: v, reason: METRIC_DEFS[id].info });
  }
  if (!def.measured && rows.length === 0) return <p className="text-xs text-ink-300">{p.sector} has no traction headline, so this project shows facts rather than metrics.</p>;
  return (
    <>
      {rows.map((m, i) => (
        <Row key={m.id} label={metricLabel(p.sector, m.id)} info={`${i === 0 && def.measured ? `The headline metric for ${p.sector}. ` : ""}${METRIC_DEFS[m.id].info}${i === 0 && def.note ? ` ${def.note}` : ""}`}>
          <Value p={p} m={m} />
        </Row>
      ))}
    </>
  );
}
