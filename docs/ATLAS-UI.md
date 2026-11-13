# CanHav Research Atlas UI standard (shared by the Robinhood and NEAR atlases)

Both dashboards are CanHav Research products and will move to `robinhood.canhav.com` and `near.canhav.com`. They must look and behave like one product family. Save this file in each repo as `docs/ATLAS-UI.md` and treat it as the shared contract. When a rule here conflicts with older code, this file wins. Chain-specific behaviour lives in each repo's own prompt.

## 1. Brand and design system

Source of truth is the CanHav design system (claude.ai design system artifact "CanHav") synced from the `canhav.dev` repo (github.com/wazarat/canhav.dev, main). Read that repo's Tailwind config and global CSS and port the tokens. Do not invent a new look.

- **Canvas.** Dark is default. Page `ink-950`, cards, menus and popovers `ink-900`. Light theme is the flat `#f5f5f7` canvas with the inverted `ink` scale. Always write against token steps, never raw hex.
- **Text.** Two tones only (amended 2026-11-09, owner request). `ink-50` for names, headings, values and body copy; `ink-300` for labels, meta, takeaways and placeholder words such as no, none, undated, undisclosed and "no ticker". No other `ink` step, no `muted-foreground` and no opacity-dimmed text; disabled controls are the only exception. A changed state (a riser, an error) may take colour. `npm run check:copy` flags any other text tone as a "tone" hit.
- **Lines.** Hairlines are `ink-700` at 60%. Dividers inside a card at 40%.
- **Action colour.** `electric-500` is the only action colour, with one primary button per view. Selected states use an `electric-500` border over a 10% tint.
- **Accents.** `neon` and `signal` are accents. `signal-400` means up or met, `rose-400` means down or failed. Only a change in value or an error takes colour.
- **No badges, chips or pills.** Tier, native-chain, risk and status labels become plain text at `label` size in `ink-300`, with any proof in `mono` `ink-500` after it. Colour only appears for a change in value or an error. Legend swatches inside charts are allowed. The one exception is the "Beta" tag in the header lockup (amended 2026-11-09, owner request).
- **Type.** `display` (Space Grotesk 600, tight tracking) for headings and KPI values, `sans` (Inter) for everything else, `mono` (JetBrains Mono) for addresses, hashes and deltas. Tabular figures in every stat and table.
- **Surfaces.** Lit, as the Studio cards on canhav.com (amended 2026-11-08, this replaces the earlier flat rule). A card is `ink-900` with a hairline and a neon tint that glows down from its top edge for a fixed 7rem (`card-lit`), so chart plots lower in the card stay on the plain surface the chart palette was validated against. Hovering a card lights its border to `neon-500` at 60%. A card that is one click target also lifts 2px with a soft neon shadow (`card-link`); a card that only holds a chart never lifts. The dark page carries the three canhav.com ambient glows (electric top, neon right, signal left) on a fixed layer; the light canvas stays flat. The header, the sticky filter bar and the compare tray are `ink-950` at 80% over a backdrop blur so the glow has no hard edge. No grid background. `radius-md` segments, `radius-lg` buttons, inputs and rows, `radius-xl` cards. `shadow-popover` stays the only elevation for menus and popovers.
- **Icons.** lucide-react outlines at 14 to 16px in `ink-400`, `ink-50` on hover. No emoji.
- **Components.** Mirror the design system patterns with the existing shadcn components restyled by the tokens. `Card` and `CardSection` for every panel, `Segmented` for two to four options, `InfoTip` for help longer than one line.
- **Logo.** A two-line lockup (amended 2026-11-09, owner request). The CanHav `mark.svg` sits on the left at the height of both lines, about 44px. Line one is "CanHav Research" in `display`; line two is the atlas name ("Robinhood Chain Atlas") in `ink-300` followed by a "Beta" tag, an `electric-500` hairline pill with `electric-300` uppercase text at 10px. The favicon is the canhav.com "ch." icon (`src/app/icon.png`, `apple-icon.png`, `favicon.ico`). Do not use any chain's logo or brand assets, and keep the "Independent research by CanHav Research, not affiliated with ..." line.

### Chart colours
The design system has no data-visualisation palette, so keep a separate chart palette. Build it from the brand hues (electric, neon, signal), give neutral categories (not tracked, not applicable, not disclosed, other, inactive) a muted violet scale instead of grey, keep one fixed colour per category across every chart, and re-run the existing colour-vision validator in both themes. Keep the second encoding (marker shape) where colour alone fails.

## 2. Voice and copy

- No em dashes and no colons in any user-facing string. Split the sentence or use a comma. Add a `npm run check:copy` script (modelled on the one in canhav.dev) that fails CI if a UI string contains either. One exception (owner, 2026-11-10): a card takeaway's lead line ends in a colon, "Over the last 30 days:", above one short dateless point per insight (`src/components/atlas/takeaway-list.tsx`).
- Sentence case for headings, buttons and labels.
- Plain factual sentences. No hype, no exclamation marks.
- Every data surface names its source. The footer carries "Research preview, not financial advice."

## 3. Page frame

- **Header.** Logo and product name on the left, then the page tabs, then "Submit a project" and the theme toggle on the right. Nothing else.
- **Footer.** Move "Data as of <date>, updated daily" out of the header into the footer, together with the data sources list, methodology link, the disclaimer, a link to the sibling atlas, and a link to canhav.com. The date reads from `_meta.json`.
- **Container.** Centred to `container-max` with 20, 24 and 32px gutters. Sections `space-16` apart.

- **Detail opens in a centred modal** (amended 2026-11-09, owner request; this replaces the side drawer). A project, a sector's leaders or a funding type opens in one shared modal (`src/components/atlas/atlas-modal.tsx`), about 960px wide on desktop and a full-screen sheet on phones. Esc and a backdrop click close it, focus is trapped and the page behind does not scroll. The open item lives in the URL (`?project=`, `?sectorDrawer=`, `?fundingType=`) so links keep working. The project modal puts the header (name, sector and native chain as plain text, website, Add to compare, Suggest a correction), Overview and Traction on the left and the history chart with its metric and range controls on the right, then Financials, Funding, Security facts, Sources, Events and Similar projects full width. Opening a project from inside another modal replaces it rather than stacking a second one.

- **Access** (added 2026-11-09, owner request; phase 1 of the login wall). One Clerk production application serves canhav.com and the atlases, so a login on one is a login on all. Overview, Methodology and the footer pages are public. For the NEAR atlas the thesis evidence is public too (2026-11-13, owner request for the hackathon judges): Overview, Thesis, Intents, Explorer, Sectors, Traction and About, each with every chart and its query; only Funding, Investors and Security stay behind the wall there, and `e2e/logged-out.spec.ts` checks the open routes in a browser context with no cookies. Every other tab, hidden ones included, shows the login pop-up ("Log in for free access", one line, "Log in" and "Create free account" opening Clerk's own modals) over a blurred, inert preview, keeping the URL so the page loads after login. Compare shows any comparison already in the URL; Add to compare anywhere opens the pop-up and finishes after login. A shared project link shows the header, Overview and Traction, with the rest behind one login panel. Submit a project and Suggest a correction stay open. The header shows "Log in" or Clerk's UserButton. The rules live in `src/lib/gate.ts`; without Clerk keys the wall is off. Phase 1 gates in the browser only; keeping gated data out of the public bundle is phase 2.
- **Tier labels.** The data keeps "Not tracked" as a tier; readers see "TBD" (`tierLabel` in `src/lib/tier.ts`). Metric cells keep "Not tracked" for a blank value.

## 4. Global controls

- **Remove the global metric switcher** (Projects, TVL, Volume, Fees, Revenue). It changes too little on most pages and confuses people.
- **No global chart control** (amended 2026-11-08, this replaces the global time range). The 7d, 30d, 90d, All control sits on each card that shows a time window, in that card's actions, and drives every panel in that card and nothing else. Each card stores its choice in the URL under its own key (`cr` chain over time, `ar` chain activity, `mr` risers and fallers, `hr` project side bar history, `xr` compare trend, `pr` `wr` `dr` stocks) and opens at 30d. A card whose data is a fixed 7, 30 or 90 day comparison does not offer All. The filter bar holds only search, facets, the result count, Reset and Copy link.
- **Charts that genuinely need a metric** (sector treemap, share of chain bars, risers and fallers, compare) get their own small `Segmented` control inside the chart card. Their choice is stored in the URL under that chart's own key. A chart that splits by a category readers may want to isolate (for example native-chain type on the business model chart) gets a `MultiSelect` in its card actions, also under its own key (`nc`), where empty means all.
- **Leaderboards stay lean** (amended 2026-11-08). A ranked table shows identity and the one figure it ranks by: Project, Sector, Native chain, Tier, TVL on Traction. No column sets, metric switch, change or sparkline columns. A row opens the side bar, which carries every other figure, including 7d, 30d and 90d change. Amended 2026-11-09: the Traction leaderboard and the Explorer may offer onchain columns (Stablecoin supply, Token volume (30d), Holders) in the Columns chooser, hidden by default, so the default view keeps its five columns.
- **Filter scope must be honest.** Any chart that ignores the filters (for example whole-chain history) stays the same when filters change; it carries no scope note (amended 2026-11-09, the owner removed "Whole chain, not filtered"). When filters are active, every filtered card shows the active filter count in its subtitle.

## 5. Coverage language

Blank metrics mean the source does not track that project. They are not unverified. Make that obvious everywhere.

- Replace "no data" with "Not tracked". Its InfoTip says "DefiLlama does not report this metric for these projects. This is a coverage gap, not a zero and not unverified data."
- KPI subtitles read "Tracked for 2 of 13 projects". If coverage is 0, the KPI value shows "Not tracked" in `ink-300` and the card is visually quieter.
- Keep "Not researched" (never checked) and "Not disclosed" (checked, nothing found) distinct, and explain all coverage terms in one Methodology block.

## 6. Charts

- **Expand.** Every chart card has an Expand button that opens a full-screen dialog with the same chart larger, its table view, its source and a range brush for zooming into a period. Esc closes it and the open chart is stored in the URL (`?expand=<chartId>`) so it can be shared.
- **Level series** (TVL, supply, holders) default to a fitted y-axis with about 10% padding, labelled clearly, plus a "Start at zero" toggle. Show the min, max and percent change for the visible range in a line under the chart, never beside the title, so small movements are readable and the line is not mistaken for a heading. Bar and flow series (volume, fees, revenue, transactions) always start at zero.
- **Default range.** Every card opens at 30d and every panel in it, level or flow, follows the card's own range control. The stats line under a level series names the window it covers.
- **Tooltips** never cover the legend or the value being hovered, and never overflow the card.
- **A share needs its benchmark** (added 2026-11-08). A split of volume across unequal buckets (hours of the week, sessions) is shown against how the buckets themselves split, as a first row and guide lines, so a reader can tell a real concentration from a bucket that is simply bigger. When pools or accounts can sit under more than one row, the total row counts each one once and the info tip says so. Volume that cannot be attributed gets its own named, hatched row; it is never folded into a venue or dropped.
- **No grids of near-identical cells.** A heat grid whose cells mostly share one colour says nothing. Summarise by the few groups that matter (for premium: NYSE open, weekdays closed, weekends) with a typical value and its usual range on one axis.
- **Every chart** keeps its source InfoTip, a Chart and Table toggle, and an empty state.
- **Takeaways and notes** (amended 2026-11-08). A one-line takeaway under a chart title is allowed only when it is generated from the data on the page, so it can never go stale. Hand-written lines and research notes (for example a double-counting caveat or a claim about one named project) leave the public page: pass them to the card's `adminNote`, which renders only on a build with `NEXT_PUBLIC_SHOW_NOTES=1`, until an admin account exists. A count inside a sentence is computed, never typed. Definitions and method caveats belong in the InfoTip or on the Methodology page.

## 7. Sector treemap

- **Labels.** Pick label colour by tile luminance (dark text on light tiles, light on dark) with no text stroke or shadow. Wrap to two lines, then truncate with an ellipsis. Hide the label on tiles too small to fit it and rely on the tooltip.
- **Drill-down.** Clicking a sector zooms into that sector instead of becoming one solid block. Inside a sector, group projects by `Subcategory` (projects with none go in "Unclassified"). If a sector has fewer than 3 subcategories, show its projects as individual tiles instead, sized by the chart's metric with untracked projects grouped in one "Not tracked" tile. Show a breadcrumb ("All sectors, Exchanges and on/off-ramps") with a back control. Clicking a subcategory tile opens the sector side bar scoped to that subcategory (title "Sector, Subcategory", URL keys `sectorDrawer` and `sectorSub`), listing its projects with a link back to the whole sector (amended 2026-11-08). Clicking a project tile opens the project drawer. The grouped "Not tracked" tile stays inert.
- **Filtering stays separate.** Applying a sector filter is its own action ("Filter to this sector") in the tooltip or breadcrumb, not the default click.

## 8. Timeline

One shared Timeline card (amended 2026-11-08: it opens as a table and every source must be direct).

- **Table first.** The card opens on its table view with four columns: Date, Type, Event, Projects. The chart (one lane per type, legend buttons that toggle types and show counts, log-scaled marker area) is the second view of the same card.
- **Detail in a popup.** Clicking a row or a chart marker opens a popup with the amount, what the amount measures, the detail and the source. The open event is stored in the URL (`?event=<id>`) so it can be shared. The same popup opens from the money flow cards on Funding and from the Events list in a project side bar. The CSV download carries every field.
- **Direct sources only.** A source must land the reader on the claim: one article, one post (`x.com/<handle>/status/<id>`) or one page about the subject. A profile, a home page or a search page is not a source. `isDirectSource` in `src/lib/sources.ts` is the rule; when a link fails it the UI says "No direct source yet" and offers no link, in the popup, the side bar and the CSV. Fix the data, do not soften the rule.
- Each atlas sets a default start date in config. In the chart view, events before it are collapsed into one "Before <date>" marker with a "Show earlier events" toggle, so the default view is not mostly empty space.

## 9. Funding

- The funding-type donut shows only projects with disclosed funding (VC-backed, token-funded, treasury, grant or program, corporate, acquired, bootstrapped, other). "Not disclosed" and "Not researched" leave the donut and become one line of text under it (for example "159 researched, 63 with disclosed funding, 96 not disclosed, 448 not researched").
- Fix the donut tooltip so it never overlaps the legend.
- **Tables of records** (added 2026-11-08). A table title carries no row count; the count lives in the table's own "Showing X of N" line, which follows its filters. A table readers may want to narrow gets its own toolbar (search, facets with counts, Reset) under its own URL keys, stacked on the page filters (backers: `bq`, `bt`, `bn`, `bk`), and sortable headers.
- **One word for an empty value.** Whatever the source file says for nothing ("None", "Unknown", "N/A", a blank), a cell shows one lower-case word in muted ink: "none" for a token or a list, "undisclosed" for an amount, "no source" for a link. Text that says something ("N/A (acquisition ~$200M)") is kept as written. This is a display rule (`src/lib/backer-filters.ts`); the parsed data is not changed.

## 10. Security and risk

- **No per-project risk ratings in public views.** Remove named High, Medium and Low lists and per-project risk labels from the Security page, tables, filters and the project modal. Keep aggregate views only, such as counts by red-flag type (no published audit found, pseudonymous team, paused or shut down, past incident) and by sector.
- **Facts stay, ratings go.** The project modal may still list sourced facts (audits found, dated incidents) in neutral wording with their source links, but no rating.
- **Incidents** become a sortable table (date, event, what happened, amount if any, source link). Remove the incident scatter chart. Keep neutral, factual wording copied from sources and never speculate about intent.
- **Chain-level risk** stays as a checklist. Status is plain text per the design system, with colour only for the status word.
- Remove the "Security risk" global filter.

## 11. Tables and overflow

- No text may overflow its cell. Long text wraps, clamps at 3 lines and gets a "Show more" control. Set sensible max widths per column. Check this at 1440 and 390px.
- Numeric columns are right-aligned with tabular figures.

## 12. Domain readiness (prepare only, do not change DNS)

- Add `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_SIBLING_ATLAS_URL` env vars and use them for canonical URLs, `metadataBase`, Open Graph URLs, sitemap and the footer cross-link. Remove every hardcoded `*.vercel.app` URL.
- Add a per-atlas Open Graph image in the brand style.
- Planned domains are `robinhood.canhav.com` and `near.canhav.com`. Note in the README how to point them at the project once ready.

## 13. Process rules for both repos

- Start in plan mode. Take Playwright screenshots of every page at 1440 and 390px in both themes before changing anything, then again after, and compare them.
- Change visuals only. Do not change data files, data scripts or validation numbers.
- Keep all unit and Playwright tests passing and add tests for the treemap drill-down, the coverage labels, the chart expand dialog, the copy lint and the funding donut grouping.
- Commit after each milestone, authored as Wazarat with no co-author or tool attribution trailers. Keep `.claude/` and any agent tooling files out of git (add them to `.gitignore` and untrack them if already committed).
- Pull with rebase before every push, because the daily data Action also commits to `main`.
