# CanHav Atlas UI standard (shared by the Robinhood and NEAR atlases)

Both dashboards are CanHav Research products and will move to `robinhood.canhav.com` and `near.canhav.com`. They must look and behave like one product family. Save this file in each repo as `docs/ATLAS-UI.md` and treat it as the shared contract. When a rule here conflicts with older code, this file wins. Chain-specific behaviour lives in each repo's own prompt.

## 1. Brand and design system

Source of truth is the CanHav design system (claude.ai design system artifact "CanHav") synced from the `canhav.dev` repo (github.com/wazarat/canhav.dev, main). Read that repo's Tailwind config and global CSS and port the tokens. Do not invent a new look.

- **Canvas.** Dark is default. Page `ink-950`, cards, menus and popovers `ink-900`. Light theme is the flat `#f5f5f7` canvas with the inverted `ink` scale. Always write against token steps, never raw hex.
- **Text.** `ink-50` for headings and values, `ink-100` body, `ink-200` labels, `ink-300` secondary copy.
- **Lines.** Hairlines are `ink-700` at 60%. Dividers inside a card at 40%.
- **Action colour.** `electric-500` is the only action colour, with one primary button per view. Selected states use an `electric-500` border over a 10% tint.
- **Accents.** `neon` and `signal` are accents. `signal-400` means up or met, `rose-400` means down or failed. Only a change in value or an error takes colour.
- **No badges, chips or pills.** Tier, native-chain, risk and status labels become plain text at `label` size in `ink-300`, with any proof in `mono` `ink-500` after it. Colour only appears for a change in value or an error. Legend swatches inside charts are allowed.
- **Type.** `display` (Space Grotesk 600, tight tracking) for headings and KPI values, `sans` (Inter) for everything else, `mono` (JetBrains Mono) for addresses, hashes and deltas. Tabular figures in every stat and table.
- **Surfaces.** Flat. A surface is `ink-900` with a hairline. No blur, glow or gradient on product pages. Skip the landing-page glows and grid background. `radius-md` segments, `radius-lg` buttons, inputs and rows, `radius-xl` cards. `shadow-popover` is the only elevation.
- **Icons.** lucide-react outlines at 14 to 16px in `ink-400`, `ink-50` on hover. No emoji.
- **Components.** Mirror the design system patterns with the existing shadcn components restyled by the tokens. `Card` and `CardSection` for every panel, `Segmented` for two to four options, `InfoTip` for help longer than one line.
- **Logo.** Use the CanHav `mark.svg` with "CanHav Atlas" set live next to it. Do not use any chain's logo or brand assets, and keep the "Independent research by CanHav Research, not affiliated with ..." line.

### Chart colours
The design system has no data-visualisation palette, so keep a separate chart palette. Build it from the brand hues (electric, neon, signal) plus neutrals, keep one fixed colour per category across every chart, and re-run the existing colour-vision validator in both themes. Keep the second encoding (marker shape) where colour alone fails.

## 2. Voice and copy

- No em dashes and no colons in any user-facing string. Split the sentence or use a comma. Add a `npm run check:copy` script (modelled on the one in canhav.dev) that fails CI if a UI string contains either.
- Sentence case for headings, buttons and labels.
- Plain factual sentences. No hype, no exclamation marks.
- Every data surface names its source. The footer carries "Research preview, not financial advice."

## 3. Page frame

- **Header.** Logo and product name on the left, then the page tabs, then "Submit a project" and the theme toggle on the right. Nothing else.
- **Footer.** Move "Data as of <date>, updated daily" out of the header into the footer, together with the data sources list, methodology link, the disclaimer, a link to the sibling atlas, and a link to canhav.com. The date reads from `_meta.json`.
- **Container.** Centred to `container-max` with 20, 24 and 32px gutters. Sections `space-16` apart.

## 4. Global controls

- **Remove the global metric switcher** (Projects, TVL, Volume, Fees, Revenue). It changes too little on most pages and confuses people.
- **Keep the time range** (7d, 30d, 90d, All) as the only global control next to the filters.
- **Charts that genuinely need a metric** (sector treemap, concentration curve, leaderboard sort, compare) get their own small `Segmented` control inside the chart card. Their choice is stored in the URL under that chart's own key.
- **Filter scope must be honest.** Any chart or KPI that ignores the filters (for example whole-chain history) shows "Whole chain, not filtered" in its subtitle and stays the same when filters change. When filters are active, every filtered card shows the active filter count in its subtitle.

## 5. Coverage language

Blank metrics mean the source does not track that project. They are not unverified. Make that obvious everywhere.

- Replace "no data" with "Not tracked". Its InfoTip says "DefiLlama does not report this metric for these projects. This is a coverage gap, not a zero and not unverified data."
- KPI subtitles read "Tracked for 2 of 13 projects". If coverage is 0, the KPI value shows "Not tracked" in `ink-300` and the card is visually quieter.
- Keep "Not researched" (never checked) and "Not disclosed" (checked, nothing found) distinct, and explain all coverage terms in one Methodology block.

## 6. Charts

- **Expand.** Every chart card has an Expand button that opens a full-screen dialog with the same chart larger, its table view, its source and a range brush for zooming into a period. Esc closes it and the open chart is stored in the URL (`?expand=<chartId>`) so it can be shared.
- **Level series** (TVL, supply, holders) default to a fitted y-axis with about 10% padding, labelled clearly, plus a "Start at zero" toggle. Show the min, max and percent change for the visible range in the subtitle, so small movements are readable. Bar and flow series (volume, fees, revenue, transactions) always start at zero.
- **Default range.** Level series default to 90d (or All when history is shorter) so there is enough shape to read. Flow series follow the global range.
- **Tooltips** never cover the legend or the value being hovered, and never overflow the card.
- **Every chart** keeps its one-line takeaway caption, its source InfoTip, a Chart and Table toggle, and an empty state.

## 7. Sector treemap

- **Labels.** Pick label colour by tile luminance (dark text on light tiles, light on dark) with no text stroke or shadow. Wrap to two lines, then truncate with an ellipsis. Hide the label on tiles too small to fit it and rely on the tooltip.
- **Drill-down.** Clicking a sector zooms into that sector instead of becoming one solid block. Inside a sector, group projects by `Subcategory` (projects with none go in "Unclassified"). If a sector has fewer than 3 subcategories, show its projects as individual tiles instead, sized by the chart's metric with untracked projects grouped in one "Not tracked" tile. Show a breadcrumb ("All sectors, Exchanges and on/off-ramps") with a back control. Clicking a project tile opens the project drawer.
- **Filtering stays separate.** Applying a sector filter is its own action ("Filter to this sector") in the tooltip or breadcrumb, not the default click.

## 8. Timeline

One shared Timeline component, modelled on the NEAR atlas timeline (summary line with counts, legend chips that toggle types and show counts, Chart and Table toggle, log-scaled marker area, note about month-only dates, click to open the source).

- Each atlas sets a default start date in config. Events before it are collapsed into one "Before <date>" marker or a "Show earlier events" toggle, so the default view is not mostly empty space.

## 9. Funding

- The funding-type donut shows only projects with disclosed funding (VC-backed, token-funded, treasury, grant or program, corporate, acquired, bootstrapped, other). "Not disclosed" and "Not researched" leave the donut and become one line of text under it (for example "159 researched, 63 with disclosed funding, 96 not disclosed, 448 not researched").
- Fix the donut tooltip so it never overlaps the legend.

## 10. Security and risk

- **No per-project risk ratings in public views.** Remove named High, Medium and Low lists and per-project risk labels from the Security page, tables, filters and the drawer. Keep aggregate views only, such as counts by red-flag type (no published audit found, pseudonymous team, paused or shut down, past incident) and by sector.
- **Facts stay, ratings go.** The project drawer may still list sourced facts (audits found, dated incidents) in neutral wording with their source links, but no rating.
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
