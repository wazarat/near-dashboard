/**
 * Who sees what (docs/ATLAS-UI.md, section 3, Access; phase 1 of the login wall, which gates in
 * the browser). Pure, so the table is tested. With the wall off (no Clerk keys) everything is allowed.
 *
 * | Area                                        | Logged out                            | Logged in |
 * | Overview, Thesis, the footer methodology    | Full                                  | Full      |
 * | Sectors, Traction, Intents, Funding,        | Login pop-up over a blurred preview   | Full      |
 * |   Investors, Security, Explorer             |                                       |           |
 * | Compare                                     | Full view of a comparison in the URL  | Full      |
 * | Add to compare, presets (anywhere)          | Opens the login pop-up, then finishes | Works     |
 * | Project pop-up                              | Header, Overview and Traction         | Full      |
 * | Sector, investor and funding type pop-ups   | Title and summary line                | Full      |
 * | Timeline event pop-up (Overview is public)  | Full                                  | Full      |
 * | Submit a project, Suggest a correction      | Open                                  | Open      |
 */
import { NAV } from "./nav";

export const PUBLIC_PATHS = ["/", "/thesis/", "/compare/", "/help-track/", "/about/"] as const;
/** Public pages that are not tabs (linked from the footer and from Not tracked info tips). */
export const PUBLIC_PAGES_OUTSIDE_NAV = ["/help-track/", "/about/"] as const;
export const GATED_PATHS = ["/sectors/", "/traction/", "/intents/", "/funding/", "/investors/", "/security/", "/explorer/"] as const;

export type GatedAction = "compare-add" | "project-detail" | "sector-detail" | "investor-detail" | "funding-detail";

function normalize(path: string): string {
  const p = path.split(/[?#]/)[0] || "/";
  return p.endsWith("/") ? p : `${p}/`;
}

/** A page that shows the login pop-up over a blurred preview when logged out. */
export function isGatedPath(path: string): boolean {
  return (GATED_PATHS as readonly string[]).includes(normalize(path));
}

/** Can a reader do this? `signedIn` is ignored when the wall is off. */
export function allowed(target: { path: string } | { action: GatedAction }, signedIn: boolean, enabled: boolean): boolean {
  if (!enabled || signedIn) return true;
  if ("path" in target) return !isGatedPath(target.path);
  return false;
}

/** Project pop-up sections a logged-out reader sees; the rest sits behind one login panel. */
export const PUBLIC_PROJECT_SECTIONS = ["header", "overview", "traction"] as const;

/** Every tab in the nav list is either public or gated, so a new tab cannot slip through unclassified. */
export function unclassifiedTabs(): string[] {
  return NAV.map((n) => n.href).filter((h) => !(PUBLIC_PATHS as readonly string[]).includes(h) && !(GATED_PATHS as readonly string[]).includes(h));
}

/**
 * An action saved before the login pop-up, replayed once the reader is signed in. It holds the
 * whole intended compare selection, because a preset or a top-project button sets several
 * projects at once.
 */
export type PendingAction = { type: "compare-set"; ids: string[] };
export const PENDING_KEY = "atlas:pending-action";

export function encodePending(a: PendingAction): string {
  return JSON.stringify(a);
}

export function decodePending(raw: string | null): PendingAction | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PendingAction>;
    if (!v || v.type !== "compare-set" || !Array.isArray(v.ids)) return null;
    const ids = v.ids.filter((id): id is string => typeof id === "string" && id.length > 0);
    return ids.length > 0 ? { type: "compare-set", ids } : null;
  } catch {
    return null;
  }
}

/**
 * What a change to the compare selection does: write it, or (an addition while logged out)
 * save the intended selection and ask for login instead. Removing and reordering never need a login.
 */
export function compareChange(current: readonly string[], next: readonly string[], canAdd: boolean): { write: string[] } | { login: PendingAction } {
  const adds = next.some((id) => !current.includes(id));
  if (adds && !canAdd) return { login: { type: "compare-set", ids: [...next] } };
  return { write: [...next] };
}

/** After login: the saved selection to write, unless the reader already holds exactly those projects. */
export function replayPending(raw: string | null, current: readonly string[]): string[] | null {
  const p = decodePending(raw);
  if (!p) return null;
  return p.ids.every((id) => current.includes(id)) ? null : p.ids;
}
