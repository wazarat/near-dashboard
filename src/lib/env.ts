/** Public env read at build time; the buttons stay hidden while unset. */
export const TALLY_SUBMIT_URL = process.env.NEXT_PUBLIC_TALLY_SUBMIT_URL || null;
export const TALLY_CORRECT_URL = process.env.NEXT_PUBLIC_TALLY_CORRECT_URL || null;

/** Canonical origin of this atlas; the planned domain when unset so a build never carries a preview host. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://near.canhav.com").replace(/\/$/, "");

/** The sibling CanHav atlas (Robinhood Chain). The footer link is hidden while unset. */
export const SIBLING_ATLAS_URL = process.env.NEXT_PUBLIC_SIBLING_ATLAS_URL || null;

/** Prefills the correction form with the project and the page it was opened from. */
export function tallyCorrectUrl(base: string, project: string, page: string): string {
  const u = new URL(base);
  u.searchParams.set("project", project);
  u.searchParams.set("page", page);
  return u.toString();
}
