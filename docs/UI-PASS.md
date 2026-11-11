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

The second pass listed six parts of the amended standard as not adopted. This pass adopts four of them: the funding-type pop-up, the Explorer map view, tables-of-records counts and the timeline's table-first view with an event pop-up. The per-card time range and the five-column leaderboard are still open and wait on the owner (see "Per-card time range, blast radius" below). Nothing under `data/`, `queries/` or `THESIS.md` changed. The visible text of Thesis, Intents, Security, Sectors, Traction and Compare is identical before and after; Explorer, Funding and Investors differ only by the lines named in the table below; Overview differs only inside the Timeline card.

## What changed

| Area | Change |
|---|---|
| Funding type | A bar or a legend entry of the funding type chart opens that type in the shared modal (`?fundingType=<type>`, `src/components/drawer/funding-type-modal.tsx`) instead of filtering the page. It lists the projects the bar counts and the rounds recorded for them, follows the active filters like the chart, and offers "Filter the atlas to this type" as its own action. "Other" can now be opened and filtered too. |
| Explorer | A Map and Table switch under `?view=` (`table` is the default, `map` is the sector treemap of the same selection with its zoom, sharing the `tm` and `tmSector` keys with the Overview chart). A wide search box that writes the same `q` as the filter bar, with `/` to focus and a project count beside it. |
| Tables of records | "Funding rounds", "Investors" and "Newly detected" carry no count in the title. Each has its own line, "Showing 42 of 42 rounds", which follows the table's own filter (`ShowingLine` in `src/components/explorer/data-table.tsx`). The funding type pop-up's tables use the same line. |
| Timeline | The card opens on its table (Date, Type, Event, Projects, Amount). A row or a chart marker opens the event pop-up (`?event=<id>`, `src/components/drawer/event-modal.tsx`) with the amount, what it measures, the detail and the source. The same pop-up opens from an Ecosystem capital card's title and from a project's Events list. The CSV carries every field, the detail included. |
| Access | `funding-detail` joins the gated actions in `src/lib/gate.ts`. Logged out, a shared funding type link shows the title and the summary line, then one login panel. The event pop-up is open to everyone, because the timeline is on the public Overview. |
| Analytics | No new event. `funding` joins the login triggers, so a sign-up that starts at the funding type panel is attributed. |

## Differences from the Robinhood atlas kept on purpose

- **The Explorer opens on its table.** Robinhood opens on the map. One default in `src/lib/filters.ts` switches it.
- **A project sits under each of its funding types.** The NEAR chart counts "VC-backed; Token-funded" in both bars, so the pop-up lists it under both and says so. Robinhood counts a project once, by its first type. The pop-up has no per-type definitions and no top backers list.
- **The funding type pop-up shows a summary when logged out.** Robinhood does not mount it for a logged-out reader. Here it behaves like the sector and investor pop-ups.
- **The timeline table keeps its Amount column.** The standard asks for four columns with the amount one click away. The amount was on the page before, so it stays as a fifth column; what the amount measures, the detail and the source moved to the pop-up and the CSV.
- **Every recorded source link is still offered.** The direct-sources rule is not applied (next section).
- **A project's Events keep their source link** next to the title, which now opens the event pop-up over the project pop-up. Closing it returns to the project.
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

## Parts of the amended standard still not adopted

- **Per-card time range** and, with it, the level series' 90-day floor. Not started; the blast radius is below.
- **The five-column leaderboard.** The Traction leaderboard keeps its four column sets, because Activity is NEAR BigQuery data with no other home.
- **Record-table toolbars** (search, facets with counts and Reset under their own URL keys, as Robinhood's backers table has). The rounds table has 42 rows and one checkbox, the investors table 67 rows.
- **The direct-sources rule**, as above.

## Per-card time range, blast radius

Today `range` is one URL key (default `30d`), set in the filter bar and carried from page to page with `compare`, `scale` and `legacy`. Moving it onto each card touches these places.

| Card | Page | Reads `range` for | Standard key |
|---|---|---|---|
| Chain over time | Overview | The window of four panels, the change in the summary, the stats line, the CSV name | `cr` |
| Chain activity | Overview | The window, the change in the summary, the CSV name | `ar` |
| Risers and fallers | Overview | Which change (7, 30 or 90 days) ranks the lists, and the spark window | `mr` |
| Leaderboard | Traction | The Trend column in the Traction and Momentum column sets | none, needs one (`lr`) |
| History | Project pop-up | The window of the history chart | `hr` |
| Trend overlay | Compare | The window of the indexed overlay; the compare tray link also carries `range` | `xr` |
| Daily volume | Intents | The window, the summary, the CSV name | none, needs one |
| Status rates | Intents | The window, the CSV name | none, needs one |

Also touched: the filter bar (the range control leaves it), `CARRIED_PARAMS` and the nav links, `compareHref`, `src/lib/filters.ts`, the chart card (a range slot in its actions), one page check that loads `?range=30d`, the README and the screenshots. About twenty source files and eight new URL keys, three of them NEAR-only.

Three decisions are the owner's, because each can move a figure or break a link.

1. **The 90-day floor.** The standard has every panel follow its card's range, so TVL at 30d would show 30 days. Today NEAR shows at least 90 days for a level series, and the line under the chart ("Low, high, change over 90 days") is computed over that window. Dropping the floor changes that line on Overview and in every project pop-up. Keeping it is a deliberate difference and moves nothing.
2. **"All" on comparison cards.** The standard drops All from a card that is a fixed 7, 30 or 90 day comparison. Risers and fallers at All shows the 90-day change today; the option would go.
3. **Old links.** A shared link with `?range=90d` would open every card at 30d unless each card falls back to the old key when its own is absent.

With the floor kept, All kept where it exists and the fallback in place, no figure changes at the default view and the work is mechanical. The Activity column set does not read `range` and is not affected either way.

## Verification

Per commit: `npm run check:copy`, `npm run lint`, `npm run typecheck`, `npm test` (147 tests), `npm run e2e` (188 checks at desktop and phone widths, dark and light, wall off; 185 run and 3 are the analytics check skipping its repeat on three of the four projects) and `npm run e2e:wall` (38 checks). `git diff --stat origin/main -- data queries THESIS.md` is empty. The visible text of thirteen pages and pop-ups was saved from a build of the branch before this pass and again after it and compared line by line. `npm run e2e:auth` still needs the Clerk development keys and was not run.

