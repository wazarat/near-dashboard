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
