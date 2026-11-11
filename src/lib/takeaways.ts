/**
 * Card takeaways (pure, so the wording is tested). A card's one-sentence summary shows in its
 * expanded view as short points (standard section 6). Every sentence is still computed by the
 * card from its own data; this only splits it for reading.
 */
export interface Takeaway {
  points: string[];
}

/**
 * Splits a summary sentence into points at semicolons and sentence ends. A full stop inside a
 * figure ("$4.1B", "97.5%") or an abbreviation is never followed by a space and a capital, so
 * numbers stay whole.
 */
export function points(text: string): Takeaway {
  const parts = text
    .split(/;\s+|(?<=[.!?])\s+(?=[A-Z0-9$])/)
    .map((p) => p.trim().replace(/[.;]$/, ""))
    .filter((p) => p.length > 0);
  return { points: parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)) };
}

export function hasTakeaway(t: Takeaway | null | undefined): t is Takeaway {
  return Boolean(t && t.points.length);
}
