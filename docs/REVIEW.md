# Reviewing community submissions

Two Tally forms feed corrections into the research CSVs. Nothing is applied automatically.

- **Submit a project**: https://tally.so/r/YjRgM6. Questions: Project name (required), Website, X handle, Sector (required, one of the 24 sectors), Native chain (one of the 6 values), What does the project do?, Contract accounts or addresses on NEAR or Aurora (one per line), Evidence link (required), Your contact (optional).
- **Suggest a correction**: https://tally.so/r/GeKgJ2. Hidden fields `project` and `page` are prefilled by the drawer as `?project=<name>&page=<url>`. "What's wrong?" options: Name, Website, Sector, Native chain, Description, Status, X handle, Contract address, Funding or investors, Token, Security or incident info, Traction or onchain data, Project is defunct or rebranded, Other. Then What should it say instead? (required), Evidence link (required), Your contact (optional).

The buttons appear on the site only when `NEXT_PUBLIC_TALLY_SUBMIT_URL` and `NEXT_PUBLIC_TALLY_CORRECT_URL` are set (Vercel environment variables and `.env.local`).

## Weekly flow

1. In Tally, export each form's submissions as CSV into `data/submissions/` (any file name ending in `.csv`).
2. Run `npm run review`. It prints one line per submitted field: `NEW PROJECT`, `≠` (differs from the current row), `=` (already matches) or `no column`, with the submitted and current values side by side. It never writes.
3. Check the evidence link. Apply approved edits to `data/near-ecosystem-2026-11-08.csv` by hand (new rows need every required column; see `src/lib/types.ts` for the allowed values). Contract accounts go to `data/contracts.csv`.
4. If rows were added or removed, update the counts and sums in `data/expected.json`; `npm run rebuild` fails until they match.
5. Commit. The daily Action and Vercel pick the change up on the next run.

`data/submissions/` is gitignored because exports can contain contact details.
