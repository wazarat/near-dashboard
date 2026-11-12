"use client";

import { Switch } from "@/components/ui/switch";
import { projects as allProjects } from "@/lib/data";
import { LEGACY_GROUP, useFilters, type LegacyCard } from "@/lib/filters";
import { cn } from "@/lib/utils";

const LEGACY_COUNT = allProjects.filter((p) => p.statusGroup === LEGACY_GROUP).length;

export const LEGACY_HELP = `${LEGACY_COUNT.toLocaleString("en-US")} legacy listings come only from the 2021 to 2023 AwesomeNEAR directory, which marks every listing active, so their real status is unknown. None carries a TVL, volume, fee or revenue figure. They are left out by default; this switch brings them back into this card only.`;

/**
 * "Include legacy (620)" for one card (src/lib/filters.ts, LEGACY_CARDS). It sits in the card's
 * actions like the range control and changes that card and nothing else; the choice lives in the
 * `legacy` URL key. `label` names the card for assistive tech.
 */
export function LegacySwitch({ card, label, className }: { card: LegacyCard; label: string; className?: string }) {
  const { legacyOn, setLegacy } = useFilters();
  const on = legacyOn(card);
  return (
    // text-label sits outside cn: tailwind-merge reads the custom size as a colour and would drop it beside text-ink-300.
    <label className={`text-label ${cn("inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-ink-300", className)}`} title={LEGACY_HELP}>
      <Switch checked={on} onCheckedChange={(v) => setLegacy(card, v)} aria-label={`Include legacy listings in ${label}`} data-testid={`legacy-${card}`} />
      <span>
        Include legacy <span className="font-mono text-ink-300">({LEGACY_COUNT.toLocaleString("en-US")})</span>
      </span>
    </label>
  );
}

/** Whether a card includes legacy listings, for its scope note. */
export function useLegacyOn(card: LegacyCard | undefined): boolean {
  const { legacyOn } = useFilters();
  return card ? legacyOn(card) : false;
}
