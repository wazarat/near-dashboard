import chainJson from "@/data/generated/chain.json";
import eventsJson from "@/data/generated/events.json";
import insightsJson from "@/data/generated/insights.json";
import investorsJson from "@/data/generated/investors.json";
import leadersJson from "@/data/generated/leaders.json";
import metaJson from "@/data/generated/meta.json";
import newlyDetectedJson from "@/data/generated/newly-detected.json";
import projectsJson from "@/data/generated/projects.json";
import roundsJson from "@/data/generated/rounds.json";
import type { NewlyDetected } from "./history-types";
import type { ChainData, EcosystemEvent, Investor, Leader, MemoInsight, Meta, Project, Round, SeriesFile } from "./types";

export const projects = projectsJson as unknown as Project[];
export const leaders = leadersJson as unknown as Leader[];
export const events = eventsJson as unknown as EcosystemEvent[];
export const rounds = roundsJson as unknown as Round[];
export const investors = investorsJson as unknown as Investor[];
export const memoInsights = insightsJson as unknown as MemoInsight[];
export const meta = metaJson as unknown as Meta;
export const chainData = chainJson as unknown as ChainData;
export const newlyDetected = newlyDetectedJson as unknown as { items: NewlyDetected[]; unmatchedCsv: string[]; unmatchedMap: string[] };

/** 90-day per-project series are loaded lazily so the main bundle stays small. */
let seriesPromise: Promise<SeriesFile> | null = null;
export function loadSeries(): Promise<SeriesFile> {
  seriesPromise ??= import("@/data/generated/series.json").then((m) => m.default as unknown as SeriesFile);
  return seriesPromise;
}

const byId = new Map(projects.map((p) => [p.id, p]));
export function projectById(id: string | null | undefined): Project | undefined {
  return id ? byId.get(id) : undefined;
}

const investorById = new Map(investors.map((i) => [i.id, i]));
export function investorByIdFn(id: string | null | undefined): Investor | undefined {
  return id ? investorById.get(id) : undefined;
}

export const leadersBySector = (() => {
  const m = new Map<string, Leader[]>();
  for (const l of leaders) {
    const arr = m.get(l.sector) ?? [];
    arr.push(l);
    m.set(l.sector, arr);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.rank - b.rank);
  return m;
})();

export const roundsByProject = (() => {
  const m = new Map<string, Round[]>();
  for (const r of rounds) {
    if (!r.projectId) continue;
    const arr = m.get(r.projectId) ?? [];
    arr.push(r);
    m.set(r.projectId, arr);
  }
  return m;
})();

export const eventsByProject = (() => {
  const m = new Map<string, EcosystemEvent[]>();
  for (const e of events) {
    for (const id of e.projectIds) {
      const arr = m.get(id) ?? [];
      arr.push(e);
      m.set(id, arr);
    }
  }
  return m;
})();
