import { metricValue } from "./metrics";
import type { MetricKey, Project } from "./types";

/**
 * Sector treemap levels (CanHav Atlas UI standard, section 7). Pure so the
 * drill-down rules and the label rules are unit tested.
 */

export type TreemapMode = "sectors" | "subcategories" | "projects";
export type TileKind = "sector" | "subcategory" | "project" | "untracked";

export interface TreemapTile {
  [key: string]: unknown;
  id: string;
  name: string;
  size: number;
  count: number;
  withData: number;
  /** Share of the tile's projects classified NEAR native, null when it has no projects. */
  nativeShare: number | null;
  fill: string;
  kind: TileKind;
  projectId?: string;
}

export interface TreemapLevel {
  mode: TreemapMode;
  sector: string | null;
  tiles: TreemapTile[];
  /** "All sectors" alone at the top, then the sector name. */
  breadcrumb: string[];
  total: number;
}

export interface SeqPalette {
  /** Six steps, low to high share of NEAR-native projects. */
  seq: string[];
  /** Tiles with no share to colour by, and the untracked tile. */
  none: string;
  /** Text colours the label picker chooses between. */
  textDark: string;
  textLight: string;
}

export const UNCLASSIFIED = "Unclassified";
export const NOT_TRACKED_TILE = "Not tracked";
export const MIN_SUBCATEGORIES = 3;

export function seqHex(t: number | null, p: SeqPalette): string {
  if (t === null || !Number.isFinite(t)) return p.none;
  const i = Math.min(p.seq.length - 1, Math.max(0, Math.floor(t * p.seq.length)));
  return p.seq[i];
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function groupTile(id: string, name: string, kind: TileKind, members: Project[], metric: MetricKey, p: SeqPalette): TreemapTile {
  let size = 0;
  let withData = 0;
  for (const m of members) {
    const v = metricValue(m, metric);
    if (v !== null) {
      size += v;
      withData += 1;
    }
  }
  const native = members.filter((m) => m.chain === "NEAR native").length;
  const nativeShare = members.length ? native / members.length : null;
  return { id, name, size, count: members.length, withData, nativeShare, fill: seqHex(nativeShare, p), kind };
}

/** Distinct subcategory names in a sector, "Unclassified" not counted. */
export function subcategoryCount(projects: Project[]): number {
  return new Set(projects.map((x) => x.subcategory).filter((s): s is string => Boolean(s))).size;
}

/**
 * One level of the treemap. With no sector, one tile per sector. Inside a
 * sector with at least three subcategories, one tile per subcategory
 * (projects without one go in "Unclassified"). Otherwise one tile per
 * project with a value, and every untracked project folded into a single
 * "Not tracked" tile (the count metric tracks every project, so no such tile).
 */
export function treemapLevel(projects: Project[], metric: MetricKey, sector: string | null, palette: SeqPalette): TreemapLevel {
  if (sector === null) {
    const bySector = new Map<string, Project[]>();
    for (const x of projects) {
      const list = bySector.get(x.sector) ?? [];
      list.push(x);
      bySector.set(x.sector, list);
    }
    const tiles = [...bySector.entries()]
      .map(([name, members]) => groupTile(`sector-${slug(name)}`, name, "sector", members, metric, palette))
      .filter((t) => t.size > 0)
      .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
    return { mode: "sectors", sector: null, tiles, breadcrumb: ["All sectors"], total: tiles.reduce((a, t) => a + t.size, 0) };
  }

  const inSector = projects.filter((x) => x.sector === sector);
  const breadcrumb = ["All sectors", sector];
  if (subcategoryCount(inSector) >= MIN_SUBCATEGORIES) {
    const bySub = new Map<string, Project[]>();
    for (const x of inSector) {
      const key = x.subcategory ?? UNCLASSIFIED;
      const list = bySub.get(key) ?? [];
      list.push(x);
      bySub.set(key, list);
    }
    const tiles = [...bySub.entries()]
      .map(([name, members]) => groupTile(`sub-${slug(name)}`, name, "subcategory", members, metric, palette))
      .filter((t) => t.size > 0)
      .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
    return { mode: "subcategories", sector, tiles, breadcrumb, total: tiles.reduce((a, t) => a + t.size, 0) };
  }

  const tiles: TreemapTile[] = [];
  const untracked: Project[] = [];
  for (const x of inSector) {
    const v = metricValue(x, metric);
    if (v === null) {
      untracked.push(x);
      continue;
    }
    if (v <= 0 && metric !== "count") {
      untracked.push(x);
      continue;
    }
    const nativeShare = x.chain === "NEAR native" ? 1 : 0;
    tiles.push({ id: `project-${x.id}`, name: x.name, size: v, count: 1, withData: 1, nativeShare, fill: seqHex(nativeShare, palette), kind: "project", projectId: x.id });
  }
  tiles.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
  const total = tiles.reduce((a, t) => a + t.size, 0);
  if (untracked.length && metric !== "count") {
    // Sized to about 3% of the level so it is visible and labelled, never mistaken for a value.
    const size = total > 0 ? Math.max(total * 0.03, 1) : 1;
    tiles.push({ id: "untracked", name: NOT_TRACKED_TILE, size, count: untracked.length, withData: 0, nativeShare: null, fill: palette.none, kind: "untracked" });
  }
  return { mode: "projects", sector, tiles, breadcrumb, total };
}

/** WCAG relative luminance of a #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Dark text on light tiles, light text on dark tiles. The threshold sits between the ramp's middle steps. */
export function labelColor(hex: string): "dark" | "light" {
  return relativeLuminance(hex) > 0.3 ? "dark" : "light";
}

/**
 * Lines to draw inside a tile, or null when the label does not fit. Wraps on
 * spaces to two lines, then ellipsises the second. Character width and line
 * height are the treemap's 11px label metrics.
 */
export function fitLabel(name: string, width: number, height: number, charW = 6.4, lineH = 13, maxLines = 2, pad = 8): string[] | null {
  const perLine = Math.floor((width - pad) / charW);
  // Fewer than six characters per line reads as noise, so the tooltip carries the name instead.
  if (perLine < 6 || height < lineH + pad) return null;
  const linesAvail = Math.min(maxLines, Math.floor((height - pad) / lineH));
  if (linesAvail < 1) return null;
  const words = name.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= perLine) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === linesAvail) {
      cur = "";
      break;
    }
  }
  if (lines.length < linesAvail && cur) lines.push(cur);
  const raw = lines.slice(0, linesAvail);
  const truncated = raw.join(" ") !== words.join(" ");
  const out = raw.map((line) => (line.length > perLine ? `${line.slice(0, Math.max(1, perLine - 1)).trimEnd()}…` : line));
  const last = out.length - 1;
  if (truncated && !out[last].endsWith("…")) {
    out[last] = out[last].length >= perLine ? `${out[last].slice(0, Math.max(1, perLine - 1)).trimEnd()}…` : `${out[last]}…`;
  }
  return out;
}
