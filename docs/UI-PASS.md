# CanHav Atlas UI pass, NEAR atlas (2026-11-08)

The visuals-and-usability pass that brings this atlas onto the shared CanHav Atlas UI standard in [`ATLAS-UI.md`](ATLAS-UI.md). The same file must stay byte-identical in the Robinhood Chain atlas repository; any later change goes into both. Nothing under `data/`, `scripts/` (other than the two new UI helpers named below), `queries/` or `THESIS.md` changed, and no number on the site or in the thesis moved.

## What changed, by standard section

| Section | Change | Commit |
|---|---|---|
| 1 Brand | canhav.dev tokens (`ink`, `electric`, `neon`, `signal`, `rose`) as CSS variables with the inverted light scale; shadcn variables remapped onto them so every primitive follows; self-hosted Inter, Space Grotesk and JetBrains Mono (`src/app/fonts`, SIL OFL); `Segmented`, `InfoTip` and `PlainState` primitives; no pills, chips or badges; chart palette built from the brand hues (table below) | `f413abd` |
| 2 Copy | 122 em dashes and colons rewritten; `npm run check:copy` (TypeScript AST scan of string literals, template chunks and JSX text) runs in `.github/workflows/ci.yml` | `f413abd` |
| 3 Frame | Header is the CanHav mark, "CanHav Atlas" with "NEAR and Aurora", the tabs, "Submit a project" and the theme toggle; "Data as of" with per-source status moved to the footer with sources, methodology link, disclaimer, "Research preview, not financial advice", the sibling atlas link and canhav.com; 1320 px container with 20, 24 and 32 px gutters | `f413abd` |
| 4 Controls | Global metric switcher removed; the date range is the only global control; treemap, concentration curve, risers and fallers, insights, sector bars and cards, leaderboard, compare and the sector drawer each own a `Segmented` metric under their own URL key (`tm`, `cc`, `mv`, `ins`, `sb`, `sg`, `lb`, `cm`, `sm`); "Security risk" facet removed; every card says "Whole chain, not filtered", "Selected projects only, not filtered" or "n filters active" | `7cd95bf` |
| 5 Coverage | Blank metrics read "Not tracked" everywhere (formatters, table cells, change cells, sparklines); KPI subtitles read "Tracked for n of m projects" and go quiet at zero coverage; coverage terms explained once in the Methodology block | `7cd95bf` |
| 6 Charts | Expand button on every chart card opens the same chart larger in a dialog with its table and query views, its source and a range brush for time series; Escape closes; `?expand=<id>` is shareable; level series (chain TVL, drawer TVL) get a fitted axis with ten percent padding, a From zero toggle, a 90-day floor and min, max and change in the subtitle; flows start at zero and follow the range; partial Intents days are a second stacked bar so a brush never shifts the hatch; every SVG pattern id is unique per render | `966df79` |
| 7 Treemap | Click a sector to zoom in; subcategories when a sector has three or more, otherwise project tiles with one "Not tracked" tile; breadcrumb with Back and a separate "Filter to this sector" action; label colour by tile luminance, two lines then ellipsis, hidden when it does not fit | `7ed9b77` |
| 8 Timeline | One shared `Timeline` component (`src/components/atlas/timeline.tsx`), default start January 2024 (`TIMELINE_DEFAULT_START`), "Show earlier events (n)" for 2021 to 2023, table lists everything | `7ed9b77` |
| 9 Funding | Chart shows disclosed funding only; "n researched, n with disclosed funding, n not disclosed, n not researched" under it | `7ed9b77` |
| 10 Security | No per-project rating anywhere (page, tables, filters, drawer, compare, CSV); facts by type and by sector computed from the Audits, Incidents, Red Flags and Status columns; incidents as a sortable table; chain checklist status as a plain word with colour only on the word | `2634e76` |
| 11 Tables | Long text wraps, clamps at three lines with Show more; numeric columns right-aligned with tabular figures; chart tables wrap text cells | `2634e76` |
| 12 Domain | `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_SIBLING_ATLAS_URL` drive `metadataBase`, canonical, Open Graph, `sitemap.xml`, `robots.txt` and the footer link; `public/og.png` rendered by `scripts/og-image.ts`; README says how to point `near.canhav.com` at the project; no `vercel.app` string in `src/`, `public/` or `e2e/` | this commit |

NEAR-specific notes from the brief: the chain presence filter stays; the thesis page is restyled only, and the rule behind the out-of-sample win count is written under its table ("a predictor wins a series when its out-of-sample R² is above zero and at least 0.01 higher than the other predictor's"); legacy listings read "Legacy listing, status unverified" with a "Hide legacy listings" switch that defaults to showing them; there is no stocks page.

## Differences from the Robinhood atlas kept on purpose

- The funding-type chart stays a horizontal bar chart (eight categories read better as bars than as a donut); it applies the disclosed-only rule and the one-line sentence the standard asks for.
- The treemap, expand dialog, shared timeline, coverage labels and copy lint were built here first, since the Robinhood repository had none of them when this pass ran. Port them from this repository rather than rebuilding.
- The live `vercel.app` URL stays in `README.md` and `docs/SUBMISSION.md` until `near.canhav.com` resolves, because the hackathon judges need a working link. Code carries no hardcoded host.

## Chart palette and colour-vision check

Built from the brand hues plus neutrals, one fixed colour per category across every chart, marker shapes kept as the second encoding for native chains.

| Slot | Dark | Light | Used for |
|---|---|---|---|
| chart-1 | #3d7bff | #2563eb | NEAR native, Intents series, milestones |
| chart-2 | #c4b5fd | #c4b5fd | Aurora native, programs |
| chart-3 | #0e7490 | #0e7490 | Other EVM, integrations |
| chart-4 | #bdd2ff | #8fb3ff | Other non-EVM, funding events |
| chart-5 | #8b5cf6 | #5b21b6 | grants |
| chart-6 | #22d3ee | #22d3ee | listings, usage series (signal) |
| chart-7 | #1d4ed8 | #1e3a8a | centralized or off-chain, governance |
| chart-8 | #a8aebf | #6b7164 | Octopus appchain, acquisitions, neutral |
| incident | #fb7185 | #e11d48 | incidents, falls |
| sequential | #1e3a8a to #bdd2ff | #dbe7ff to #1e40af | treemap native share |

Validator (`dataviz` skill, `validate_palette.js`, run on the eight slots in order and on the six native chains in their stacking order, dark against `#0a0c14` and light against `#ffffff`): adjacent-pair colour-vision separation passes in both themes (worst adjacent pair ΔE 19.6 protan in dark, 20.8 protan in light), the normal-vision floor passes (worst 23.5 dark, 22.2 light). The lightness-band and chroma-floor checks fail by construction, because three cool brand hues plus neutrals cannot fill a full-hue band; an all-pairs check also fails for some non-adjacent pairs (pale violet against bright cyan, 2.0 deutan). The second encoding covers that: marker shapes per native chain in every scatter, percent labels and tooltips on stacked bars, a legend on every multi-series chart and a table view on every card. Three light steps sit below 3:1 against white in light mode, which the validator flags as needing visible labels or a table view; both exist.

## Before and after

Before screenshots (every page at 1440 and 390 px, dark and light) were taken on commit `05d7221` before any change and kept outside the repository; the after set was taken on the final commit. The committed `docs/screenshots/` holds the dark 1440 and 390 px set, replaced in place. The full before-and-after comparison in both themes was delivered as a private page alongside this pass.

## Verification per milestone

`npm run check:copy`, `npm run lint`, `npm run typecheck`, `npm test` (110 tests, including treemap drill-down, coverage labels, chart frame, copy lint, funding grouping, timeline split and security facts), `npm run build` and `npm run e2e` (four projects: desktop and phone, dark and light; 124 checks with zero console errors and no horizontal overflow), then a browser check at 1440 and 390 px in both themes. Every commit is authored as Wazarat Hussain with no attribution trailers, pulled with rebase before each push.

# Second pass, 2026-11-11: lockup, login wall, analytics and the amended standard

The Robinhood Chain atlas amended the shared standard after the first pass and added a login wall and analytics. This pass brings the NEAR atlas level with it. [`ATLAS-UI.md`](ATLAS-UI.md) is again byte-identical with the Robinhood copy. Nothing under `data/`, `queries/` or `THESIS.md` changed and no number on the site moved; the only changes a reader sees in figures are the wording "Tracked for 84/1,088 projects" (was "84 of 1,088") and an untracked tier reading "TBD".

## What changed

| Area | Change |
|---|---|
| Brand | Two-line lockup: the CanHav mark at 44px, "CanHav Research", then "NEAR Atlas" with the Beta tag. The name lives in `src/lib/site.ts` and feeds page titles, Open Graph and the share card. The `ch.` favicon set (`src/app/icon.png`, `apple-icon.png`, `favicon.ico`). Every page carries its own canonical URL. |
| Platform | Served by Next instead of a static export; pages still prerender as static HTML. `src/proxy.ts` runs Clerk when its keys are set. |
| Access | One Clerk application serves canhav.com and the atlases. The rules are in `src/lib/gate.ts`. Without Clerk keys the wall is off. |
| Analytics | Vercel Web Analytics with thirteen custom events (`src/lib/track.ts`), each with at most two properties from closed sets. |
| Surfaces | Cards lit from the top edge, the three ambient lights on the dark page, translucent header, filter bar and compare tray. |
| Text | Two tones, `ink-50` and `ink-300`, enforced by `npm run check:copy` as a "tone" hit. |
| Tiers | An untracked tier reads "TBD" (`tierLabel` in `src/lib/tier.ts`); one shared explainer built from the thresholds. Metric cells and the CSV export keep "Not tracked". |
| Detail | Project, sector and investor details open in one centred modal (`src/components/atlas/atlas-modal.tsx`), a full-screen sheet on a phone. Opening a project from the sector or investor modal replaces it. The sector modal follows the active filters and says so. URL keys are unchanged (`project`, `sectorDrawer`, `investor`). |
| Controls | Result count on the first row of the filter bar with Reset and Copy link under it. KPI text shortened and no longer cut off. The low, high and change line sits under its chart. No "Whole chain, not filtered" note. |
| Charts | Card summaries show as points in the expanded view. Chart card controls wrap under the title when both do not fit. Bar labels stay on one line. Sector cards show their stats at display size. |

## Who sees what

| Area | Logged out | Logged in |
|---|---|---|
| Overview, Thesis, the footer methodology | Full | Full |
| Sectors, Traction, Intents, Funding, Investors, Security, Explorer | Login pop-up over a blurred, inert page; the URL is kept | Full |
| Compare | A comparison already in the URL renders; removing works | Full |
| Add to compare, presets, top-project buttons | Login pop-up; the intended selection is written after sign-in | Works |
| Project pop-up | Header, Overview and Traction, then one login panel | Full |
| Sector and investor pop-ups from a shared link | Title and summary line, then one login panel | Full |
| An expanded chart link on a gated tab | Stays closed | Opens |
| Submit a project, Suggest a correction | Open | Open |

This is phase 1 of the wall: it gates in the browser. The page's data is still in the bundle, and this repository and its data are public, so the wall is a sign-up prompt, not a secret.

## Analytics events

`tab_view`, `project_open`, `sector_open`, `investor_open`, `chart_expand`, `chart_view`, `csv_download`, `filter_use`, `compare_add`, `login_prompt_shown`, `signup_complete`, `correction_click`, `submit_project_click`. A property value outside its closed set is dropped, so no name, account, investor, URL or typed text can be sent; `tests/track.test.ts` checks that. `auth` is `off` (no wall in this build), `in` or `out`.

## Differences from the Robinhood atlas kept on purpose

- **Every tab is shown.** The standard's Access paragraph names Overview and Methodology as the public pages and mentions hidden tabs. Here no tab is hidden, and Thesis is public as well, because it is the argument this atlas makes. Agreeing the two documents needs one clause in the shared file.
- **Thesis and NEAR Intents keep their card summaries on the card**, not only in the expanded view.
- **Analyst notes and the TVL double-count note stay public.** The standard sends hand-written notes to an admin-only build; here they carry real information for readers.
- **The treemap still zooms into a sector.** The Robinhood code opens the sector pop-up from a tile; the written standard asks for the zoom.
- **Sector cards keep "With traction".** With 1,088 mostly unmeasured projects it is the figure that says how much of a sector is live.
- **The funding-type chart stays a bar chart**, as before.

## Parts of the amended standard not adopted yet

Per-card time range (the date range is still the one global control, and level series keep their 90-day floor), the five-column leaderboard (the Activity column set is NEAR BigQuery data), the timeline's table-first view with an event pop-up and the direct-sources rule, tables-of-records toolbars, the funding-type modal, and the Explorer map view.

## Parts that do not apply to NEAR

Hidden tabs, the stocks page and its keys (`pr`, `wr`, `dr`), share-of-chain bars on DefiLlama chain totals (the concentration curve stays), onchain columns from Blockscout and GeckoTerminal, the sector metric registry, and the gated data API of the wall's phase 2.

## Verification

Per commit: `npm run check:copy`, `npm run lint`, `npm run typecheck`, `npm test` (144 tests), and `npm run e2e` (153 checks at desktop and phone widths, dark and light, wall off, zero console errors and no horizontal overflow). `npm run e2e:wall` (38 checks) covers the logged-out wall on a build that treats every reader as logged out. `npm run e2e:auth` repeats those against a Clerk development instance and adds the signed-in checks; it needs the development keys and skips without them.

# Third pass, 2026-11-11: the rest of the amended standard

The second pass listed six parts of the amended standard as not adopted. This pass adopts five of them: the funding-type pop-up, the Explorer map view, tables-of-records counts, the timeline's table-first view with an event pop-up and, on the owner's go-ahead the same day, the per-card time range. The five-column leaderboard stays open. Nothing under `data/`, `queries/` or `THESIS.md` changed and no figure moved. After the first four changes the visible text of Thesis, Intents, Security, Sectors, Traction and Compare was identical to the build before the pass; Explorer, Funding and Investors differed only by the lines named in the table below, and Overview only inside the Timeline card. The time range change then moved the four labels "7d, 30d, 90d, All" from the filter bar of every page onto the eight cards that have a time window, and changed one phrase under Chain over time ("flows follow the range control"); nothing else in the text of any page changed.

## What changed

| Area | Change |
|---|---|
| Funding type | A bar or a legend entry of the funding type chart opens that type in the shared modal (`?fundingType=<type>`, `src/components/drawer/funding-type-modal.tsx`) instead of filtering the page. It lists the projects the bar counts and the rounds recorded for them, follows the active filters like the chart, and offers "Filter the atlas to this type" as its own action. "Other" can now be opened and filtered too. |
| Explorer | A Map and Table switch under `?view=` (`table` is the default, `map` is the sector treemap of the same selection with its zoom, sharing the `tm` and `tmSector` keys with the Overview chart). A wide search box that writes the same `q` as the filter bar, with `/` to focus and a project count beside it. |
| Tables of records | "Funding rounds", "Investors" and "Newly detected" carry no count in the title. Each has its own line, "Showing 42 of 42 rounds", which follows the table's own filter (`ShowingLine` in `src/components/explorer/data-table.tsx`). The funding type pop-up's tables use the same line. |
| Timeline | The card opens on its table (Date, Type, Event, Projects, Amount). A row or a chart marker opens the event pop-up (`?event=<id>`, `src/components/drawer/event-modal.tsx`) with the amount, what it measures, the detail and the source. The same pop-up opens from an Ecosystem capital card's title and from a project's Events list. The CSV carries every field, the detail included. |
| Time range | No global range control. Each of the eight cards with a time window has its own 7d, 30d, 90d, All control in its actions and its own URL key, and opens at 30d (`RangeControl` in `src/components/atlas/range-control.tsx`, `RANGE_KEYS` in `src/lib/filters.ts`). The filter bar holds search, facets, the result count, Reset, Copy link and the legacy switch. |
| Access | `funding-detail` joins the gated actions in `src/lib/gate.ts`. Logged out, a shared funding type link shows the title and the summary line, then one login panel. The event pop-up is open to everyone, because the timeline is on the public Overview. |
| Analytics | No new event. `funding` joins the login triggers, so a sign-up that starts at the funding type panel is attributed. |

## Differences from the Robinhood atlas kept on purpose

- **The Explorer opens on its table.** Robinhood opens on the map. One default in `src/lib/filters.ts` switches it.
- **A project sits under each of its funding types.** The NEAR chart counts "VC-backed; Token-funded" in both bars, so the pop-up lists it under both and says so. Robinhood counts a project once, by its first type. The pop-up has no per-type definitions and no top backers list.
- **The funding type pop-up shows a summary when logged out.** Robinhood does not mount it for a logged-out reader. Here it behaves like the sector and investor pop-ups.
- **The timeline table keeps its Amount column.** The standard asks for four columns with the amount one click away. The amount was on the page before, so it stays as a fifth column; what the amount measures, the detail and the source moved to the pop-up and the CSV.
- **Every recorded source link is still offered.** The direct-sources rule is not applied (next section).
- **A project's Events keep their source link** next to the title, which now opens the event pop-up over the project pop-up. Closing it returns to the project.
- **Level series keep their 90-day floor** (owner, 2026-11-11). The standard has every panel follow its card's range. Here TVL shows at least 90 days at 7d and 30d, so the "Low, high, change over 90 days" line under it reads as it did before.
- **Risers and fallers keeps All** (owner, 2026-11-11). The standard drops All from a card that is a fixed 7, 30 or 90 day comparison. Here All stays and ranks by the 90-day change, as before.
- **The old `range` key is still read** (owner, 2026-11-11). Nothing writes it, but a card with no key of its own falls back to it, so a link shared before the change opens every card on the range it carried. It is still carried from page to page for the same reason.
- **Three range keys are NEAR's own**, `lr`, `ir` and `rr`, for cards the Robinhood atlas does not have.
- **Pop-up section headings keep their counts** ("Portfolio (n)", "Rounds (n)", "All other projects (n)"). They head short lists inside a pop-up, not tables of records.

## The direct-sources rule, not applied

Robinhood's `isDirectSource` (a link must have a path; on X only a single post counts) was run against the built data without changing anything.

| Links | Recorded | Would be hidden |
|---|---|---|
| Event sources | 141 of 141 events | 1 |
| Round sources | 42 of 42 rounds | 1 |
| Project security sources | 31 | 0 |
| Project discovery sources | 1,088 | 5 |
| Project funding sources | 78 cells | 16 |

The one event and the one round are the same link, `coinchapter.com/?p=140167`, which is an article; the rule fails it only because the address has no path. The five discovery sources are project home pages. Of the sixteen funding source cells, one is that same article link and fifteen are not links at all (fourteen read "N/A", one has a note after the address); all but two of the fifteen belong to projects whose funding is Not disclosed. The project pop-up still renders those cells as links today; the new funding type pop-up shows "none" for them. Applying the rule, and cleaning the "N/A" cells, is the owner's call.

## Per-card time range, as built

| Card | Page | Key | The range drives |
|---|---|---|---|
| Chain over time | Overview | `cr` | The window of the flow panels (TVL keeps its 90-day floor), the change in the summary, the CSV name |
| Chain activity | Overview | `ar` | The window, the change in the summary, the CSV name |
| Risers and fallers | Overview | `mr` | Which change (7, 30 or 90 days) ranks the lists, and the spark window |
| Leaderboard | Traction | `lr` | The Trend column of the Traction and Momentum column sets; the control hides on Activity and Financials, which have no Trend column |
| History | Project pop-up | `hr` | The window of the history chart |
| Trend, indexed | Compare | `xr` | The window of the indexed overlay |
| Daily volume | Intents | `ir` | The window, the summary, the CSV name |
| Outcome rates | Intents | `rr` | The window, the CSV name |

A card's range is its own key, else the old `range` key, else 30d (`cardRange`). Picking the value a card would show anyway clears its key, so a default view has a clean URL (`cardRangeWrite`). Range keys are chart keys and stay on their page.

## Parts of the amended standard still not adopted

- **The five-column leaderboard.** The Traction leaderboard keeps its four column sets, because Activity is NEAR BigQuery data with no other home.
- **Record-table toolbars** (search, facets with counts and Reset under their own URL keys, as Robinhood's backers table has). The rounds table has 42 rows and one checkbox, the investors table 67 rows.
- **The direct-sources rule**, as above.

## Verification

Per commit: `npm run check:copy`, `npm run lint`, `npm run typecheck`, `npm test` (152 tests at the end of the pass), `npm run e2e` (200 checks at desktop and phone widths, dark and light, wall off; 197 run and 3 are the analytics check skipping its repeat on three of the four projects) and `npm run e2e:wall` (38 checks). `git diff --stat origin/main -- data queries THESIS.md` is empty. The visible text of thirteen pages and pop-ups was saved from a build of the branch before this pass, again after the first four changes and again after the time range change, and compared line by line each time. `npm run e2e:auth` still needs the Clerk development keys and was not run.

# Fourth pass, 2026-11-12: tabs in the header, legacy listings, filters across Overview

Wazarat compared the atlas with the Robinhood landing page and asked for four things. The per-card time range was already on this branch from the third pass, and he chose to keep Chain over time's four panels in one row rather than two by two. The other three are below. Nothing under `data/`, `queries/` or `THESIS.md` changed and no TVL, volume, fee or revenue figure moved with no filter set; the figures that do change are listed and are changes he asked for.

## What changed

| Area | Change |
|---|---|
| Header | The page tabs sit between the lockup and Submit a project, as on the Robinhood atlas, from 1360px. Ten tabs need 718px at that width with Submit a project and Log in showing, and the container leaves 782px; below 1360px they keep their own scrolling row. On a phone Log in shows its icon only, so the lockup and both buttons fit. |
| Legacy listings | Hidden by default. The 620 rows from the 2021 to 2023 AwesomeNEAR directory carry no TVL, volume, fee or revenue figure, so only counts move. Each card whose counts they change has its own "Include legacy (620)" switch in its actions. The `legacy` URL key lists the cards that include them (`?legacy=kpi,sectors`); `LEGACY_CARDS` in `src/lib/filters.ts` is the list. Picking "Legacy listing" in the Status filter shows them anywhere, and the Status counts include them. The switch left the filter bar, and it is a card control, not a filter, so it no longer counts towards "n filters active" or `filter_use`. |
| Overview under a filter | **Chain over time** becomes **Selection over time**, which sums the selection's own DefiLlama daily history for TVL, DEX volume, fees and revenue (`src/lib/selection-series.ts`, `src/components/charts/selection-over-time.tsx`). That history covers the last 90 days for 132 projects, so 90d and All both show 90 days, and TVL keeps its 90-day floor. Summed protocol TVL double counts liquid staking and bridges, so the selection's share is taken against the same sum over every tracked project, never against DefiLlama's chain TVL. **Chain activity** swaps its function calls panel for calls to the selection's tracked contracts; transactions, accounts, contracts called and receipts cannot be split by project, so those panels stay chain-wide and are labelled "Whole chain". The **Timeline** keeps only events tagged with a selected project. The **Summed TVL** tile replaces "Chain TVL" with "x% of all summed TVL". Every other Overview card already followed the filters. |

Cards with a legacy switch:

| Page | Cards |
|---|---|
| Overview | KPI tiles, Sectors treemap, Insights, Native vs imported |
| Sectors | Sector bars, Traction tier by sector, Sector cards, the sector pop-up |
| Traction | Leaderboard, Activity without TVL, Listed vs live |
| Funding | Funding type (its pop-up follows it) |
| Security | Security facts and Security facts by sector (one switch) |
| Explorer | The table and the map (one switch) |

Concentration, Risers and fallers, Business model, Financials and the money columns get no switch, because no legacy row reaches them.

## Figures that differ by design

The visible text of fourteen pages and pop-ups was saved from a build of this branch after the 2026-11-12 data merge and again after this pass, then compared.

- **Every page:** the filter bar reads "Showing 468 of 1,088 projects" and has no legacy switch. The Status paragraph of the footer methodology gains one sentence. On Thesis, Intents, Compare and Investors those are the only differences.
- **Overview, with no filter set:**
  - Projects reads 468 (of 1,088), with 250 NEAR-native instead of 657.
  - Coverage lines change their denominator: "Tracked for 77/468 projects" for TVL, which was "84/1,088", because seven legacy rows report a $0 TVL; volume, fees and revenue keep 12, 13 and 9.
  - The treemap, Insights and Native vs imported count 468 projects.
  - Every money figure, the chain cards and the Timeline are unchanged.
- **Sectors, Traction, Funding, Security and Explorer:** the counts on the switched cards drop by the legacy rows they held. Among them are funded projects found only in the old directory, such as Octopus Network and Mintbase. The funding type bars drop by those, and Activity without TVL loses Octopus Network and AstroDAO.
- **Overview with `?chain=Other+EVM`:** Selection over time shows $4.4M summed TVL for the 33 of 113 selected projects with history (low $4.3M, high $4.7M, −5.9% over 90 days, 1% of the summed TVL of every tracked project), checked by hand against `series.json`. Chain activity shows calls to the 3 selected projects with tracked contracts, and the Timeline lists the events tagged with a selected project.

## Differences from the Robinhood atlas kept on purpose

- **Filters reach the chain cards.** The shared standard says a whole-chain card stays the same when filters change. Here, at the owner's request, Chain over time and the Timeline switch to the selection, and Chain activity splits what it can and labels the rest "Whole chain". With no filter set they are the whole-chain cards they were.
- **Legacy listings are hidden by default, with a switch per card.** The Robinhood atlas has no legacy rows.
- **The tabs join the header row at 1360px, not 1280px.** NEAR has ten tabs to Robinhood's six.

## Found, not fixed

`cn` in `src/lib/utils.ts` runs tailwind-merge without the design system's custom font sizes, so `text-label` (and the other custom sizes) is dropped whenever a `text-ink-*` colour sits beside it in one `cn` call. The text then inherits its parent's size. This pass keeps `text-label` outside `cn` for the scope note and the legacy switch. Fixing `cn` itself, by registering the custom sizes with `extendTailwindMerge`, would resize every plain-text label that hits it, such as tier and chain labels, so it needs its own before-and-after check.

## Verification

Per commit: `npm run check:copy`, `npm run lint`, `npm run typecheck`, `npm test` (157 tests), `npm run e2e` (208 checks; 205 run and 3 are the analytics check skipping its repeat on three of the four projects) and `npm run e2e:wall` (38 checks). `git diff --stat origin/main -- data queries THESIS.md` is empty.

# Live data, step S, 2026-11-12

Step S of [`LIVE-DATA.md`](LIVE-DATA.md) (section 5), with the `cn` fix before it. Each item is its own commit on `main`.

## What changed

| Area | Change |
|---|---|
| `cn` | `src/lib/utils.ts` registers the design system's text sizes (`micro`, `label`, `body`, `control`, `card-title`, `title`, `stat`) with tailwind-merge, so `text-label` beside `text-ink-300` keeps both. Before, the size was dropped and the text inherited its parent's. Measured on Overview, Sectors, a project pop-up and Intents at 1440 and 390px: 350 control labels went from 14 to 12px (range, metric, Chart and Table, Fitted and From zero, Reset, Copy link, Filters), the KPI values from 16 to 24px. None is below 12px. |
| Chain over time | Six panels: Chain TVL, DEX volume, Protocol fees, Gas fees, Protocol revenue, Transactions. Gas fees are the chain's own, from DefiLlama's chain fee summary; the old "fees" summed only the protocols and left the chain row out, which is why Aurora read about $5 a month instead of about $2,071. Transactions are NearBlocks for NEAR and Aurora Blockscout (a new fetcher) for Aurora. Aurora revenue reads Not tracked with DefiLlama's reason, never $0. |
| Zero days | `src/lib/chain-gaps.ts`. A reported 0 in gas fees or transactions is drawn as a gap. For other flows a 0 is a gap only when the chain had no transactions that day, the spec's rule. The spec's fixture marks Aurora's $0 gas days of Nov 1, 5 and 9 as gaps although Aurora had transactions, which only the stricter rule for gas allows. |
| Registry | `src/lib/sector-metrics.ts` holds every sector's metrics, headline, info text and `measured` flag, and the five value states. The project pop-up and the sector cards render from it; a metric that does not apply to a sector is not shown at all. |
| Tiers | The eight unmeasured sectors read "Not applicable" instead of a tier or TBD. This moves NEAR Protocol (was Tier 2), Aurora, HERE Wallet, Ante Finance and Risk Harbor (were Tier 3) and every TBD in those sectors. |
| New figures | Borrowed and own-token staking from DefiLlama's `-borrowed` and `-staking` views; total deposited as TVL plus borrowed (Rhea Lend $168.8M on Nov 11). Values with no live source yet come from the dated snapshot `data/near-live-metrics-2026-11-12.csv`, all 468 rows joined, and show their date once more than three days old. |
| Overview tiles | Coverage reads "Tracked for X of Y where it applies", where Y leaves out the unmeasured sectors and defunct or inactive projects (TVL 34 of 107, was 77/468). New tiles: Total borrowed, and 30d DEX volume without NEAR Intents, beside the volume tile now labelled "Including NEAR Intents". |
| Help us track this | `/help-track/`, public, linked from the footer and from every Not tracked row in a project pop-up. 199 projects in measured sectors have at least one applicable metric with no source; the page lists them by metric with a link to suggest a source. |
| Data checks | `npm run check:data` (`src/lib/data-checks.ts`): NEAR daily transactions from NearBlocks and from BigQuery must agree within 10% over the last 7 shared days (they agree exactly), and a chain's gas fees must not be missing for more than 3 days in a row while it has transactions. It runs in CI and in the daily refresh before the commit, not in the Vercel build. |

## Not done in step S

Done in steps M and L below.

## Found, not fixed

- The help page lists every not-tracked metric, so on a phone it runs very long (about 28,000px). Collapsing each group, or showing only the headline metric by default, would fix it.
- Aurora's protocol fees panel is real but nearly empty (a few dollars a month).

# Live data, steps M and L, 2026-11-12

The rest of [`LIVE-DATA.md`](LIVE-DATA.md), sections 3 to 5, run without a pause between steps at the owner's request. Every new source is its own fetcher in `scripts/fetch/`, runs in the daily refresh, writes its status to `data/history/_meta.json`, skips gracefully on failure and retries a 429 on the server side. Each stores a dated snapshot under `data/history/extra/`, so every value on the site carries the day it was read.

## Step M

| Source | What it adds | Where it shows |
|---|---|---|
| DefiLlama stablecoins | USD-pegged supply on NEAR ($131.9M) and Aurora ($4.0M), every coin once. `data/stablecoin-map.csv` marks one row per coin primary, so DAI and DAI by MakerDAO never count twice (rule 9). | Stablecoin supply tile; the stablecoin projects' headline |
| DefiLlama yields and lendBorrow | Utilization and a borrow-weighted borrow APY for lenders (Rhea Lend 83.9% and 14.3% across the markets DefiLlama lists), staking APY for liquid staking (Rhea LST 4.4%), largest-pool APY and pool count. | Project pop-up |
| DefiLlama aggregators and bridge aggregators | 30-day volume routed by LeoDex, De1, DZap, Rubic, StableFlow and others, joined through the map. | Project pop-up |
| DefiLlama hacks | The four exploits on NEAR or Aurora (Ref Finance 2021, Skyward 2022, Rhea Lend and Sweat in April 2026). | Security section of the pop-up; a data-check review entry when the events file has no matching Incident |
| GeckoTerminal | 24h volume and liquidity over each DEX's top pools on NEAR and Aurora (`data/geckoterminal-map.csv`). NEAR Intents shows volume and never liquidity (rule 6). | Project pop-up |
| NearBlocks and Aurora Blockscout stats | Nodes online (371), lifetime transactions and addresses. With the chain series, 30-day gas fees, transactions and DEX volume. | Chain facts on the NEAR Protocol and Aurora pop-ups only |
| NearBlocks token list | Supply on NEAR times price, for project tokens matched by contract; never for a stablecoin (rule 5). | Project pop-up |

## Step L

| Item | What it does |
|---|---|
| Contracts and tokens | `npm run seed:contracts:metrics` adds every token contract on NEAR and Aurora and every known contract from the snapshot CSV to `data/contracts.csv`, plus launchpad factories, and marks a row Verified only when the account exists on NearBlocks or Aurora Blockscout. It now holds 110 rows across 52 projects, 109 of them verified, with 34 token contracts and 1 factory. The one account that does not exist (`tge-lockup.sweat`) stays listed as Verified No. A NEAR Catalog row that credited LiNEAR's main contract to Phoenix Bonds was removed, so LiNEAR's activity counts once. |
| Spoof guard | A token reaches a project only by contract id or address, never by symbol (`isContractId` in `src/lib/extra-join.ts`, tested). One account belongs to one project: the snapshot's token column decides a token's owner, a contract already owned elsewhere is not added, and `npm run check:data` lists any account mapped twice. This dropped a stale row that gave Rhea Lend the RHEA token, and kept LiNEAR's contract off Phoenix Bonds. |
| Holders | A new `holders` source counts holders for every verified token contract, on NEAR from NearBlocks and on Aurora from Blockscout, one dated point per run. NearBlocks allows about 6 calls a minute without a key; an optional `NEARBLOCKS_API_KEY` secret makes it faster. Holders never set a tier (rule 10). |
| BigQuery | The daily receipts scan already sums function calls and signers per project from `data/contracts.csv`, so every newly verified contract is covered from the next run. The same scan now attributes account creations under a launchpad factory to that factory (`queries/daily_receipts.sql`), which gives tokens launched per launchpad at no extra scan cost. Only Meme Cooking's factory is confirmed so far (JAMBO is `jambo-1679.meme-cooking.near`). |
| NEAR Intents per app | `npm run seed:referrals` lists the top 50 referral tags by 30-day volume in `data/intents-referrals.csv` and matches them to projects by name. An exact name match is verified and shown; a looser match is listed with Verified No until someone labels it. App fees per app are Not tracked, because the Explorer reports them by fee recipient rather than by referral. The volume shows on each app's pop-up and in a new card on the Intents page, and is never added to the app's DEX volume. |
| Accuracy rule 1 | A project's Other traction signal shows the date of the research snapshot it came from, and folds behind "Older figure" once that is more than 30 days older than the data. |

## For the owner to label or decide

- `data/intents-referrals.csv`: 10 referral tags are matched and shown, 8 have a suggested project waiting for a label (Rango Exchange, Allbridge, NEAR Mobile Wallet, Rhea Finance, LayerZero, Meteor Wallet, NEAR Intents' own app), and 32 have no match. The four Aurora widget tags are among the unmatched ones, since "Aurora" and "Aurora+" are ambiguous. Setting Verified to Yes on a row shows its volume from the next build.
- The Ref Finance exploit of August 2021 on DefiLlama's hacks list has no Incident event in the events file.
- More launchpad factories (JustHoot, Nearly, Shards, NEARRR.fun, Pump.fun on NEAR) once their factory accounts are confirmed.
- The BigQuery query change could not be dry-run locally, because the local Google login has expired. The daily refresh runs it with its own credentials; if it fails, the other sources still commit.

## Not adopted from the spec

- A 30-day distinct-signer count. The BigQuery history holds distinct signers per day, so the site keeps "7d signers", which is a sum of daily counts, and labels it an estimate.
- Volume of tokens launched on each launchpad, which needs GeckoTerminal token pools matched to each factory.
- The spec's count of 45 projects "tagged NEAR Intents". The dataset has no such tag, so referral tags are matched against every project instead.

## Final sprint, Nov 13, 2026

The sprint closed the thesis track's gaps and added three datasets. Every commit is on `main`.

| Phase | What changed |
|---|---|
| 1. Track compliance | Every chart on Overview and Intents has a collapsed "How this is calculated" block with one plain sentence and its SQL file, endpoint or transform (`src/lib/query-specs.ts`). SQL is read from `queries/*.sql` at build time, which ended a stale copy in Chain activity. THESIS.md follows Claim, Data and method, Evidence for, Evidence against, What would change my mind, Metrics that could not be computed, How to reproduce. A largest-days-removed robustness check was added; it cuts against the claim and is listed as such. `npm run verify:rebuild` proves a fresh clone rebuilds 15 files byte for byte, and CI fails if a rebuild changes THESIS.md or README.md. The README gained the two-sentence thesis, the cost note and a generated data-as-of line. `/about` states the independence line. |
| 2. Honest tiles | Applicability now follows how projects earn. TVL went from 34 of 107 to 31 of 76, fees from 11 of 84 to 10 of 103, DEX volume from 7 of 83 to 7 of 66, and revenue from 6 of 61 to 7 of 10. A money level series is compared only from a start of at least $1M and 1% of the last value, so chain TVL no longer reads +7,125,924%. Aurora transactions take their history from BigQuery receipts to `aurora` (within 1% of Blockscout), and panels whose data starts after the range are clipped and labelled. |
| 3. Gas generated | `queries/daily_gas.sql` sums NEAR burnt per tracked account from `execution_outcomes`; its dry run was 0.21 GB a day, and it reaches back at most 90 days. Each project shows 30d gas paid by users and the contracts' 30% share, in the pop-up, a leaderboard column and an Overview tile, kept out of every fee total. |
| 4. Intents app fees | Trimmed 1Click rows keep the app fee rate in basis points, with the protocol's 1 bps buyback fee to `buybacks.multisignature.near` left out. Each day sums amountInUsd × bps per referral, and 30d app fees show per app. They count as revenue, marked as from NEAR Intents, only where DefiLlama reports none. The last 35 days were re-read to add the rates. |
| 5. Contracts | The `game` and `treasury` roles were added (treasury only from an evidence list). `docs/FEE-ACCOUNTS-REVIEW.md` lists fee-account candidates for 10 projects, all unused until confirmed. |
| 6. Checks | `check:data` cross-checks every Overview headline that has a second source. A tested runner keeps a failed source's last good data. `docs/SUBMISSION.md` holds the checklist, the steps for the owner and the demo script. |

Found during the sprint:
- On Nov 13, DefiLlama's `yields.llama.fi/lendBorrow` began returning 404, and its replacement answers 402 (paid). Pool APYs still refresh; supplied, borrowed, utilization and borrow APY keep their last good values and show their date once stale.
- NEAR new accounts differ by about 49% between NearBlocks and BigQuery CREATE_ACCOUNT, because BigQuery counts sub-accounts too. It is listed for review, not as a failure.
