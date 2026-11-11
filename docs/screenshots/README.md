# Screenshots

Full-page captures of every page at 1440 px (desktop) and 390 px (phone) in dark mode, written by `npm run screenshots`, which builds for itself. The `-desktop` and `-phone` suffixes name the viewport. The e2e suite also captures both widths in light mode (`-light` suffix) under `e2e/screenshots/`, which is not committed to keep the repository small; the before-and-after set from the UI pass is summarised in [`../UI-PASS.md`](../UI-PASS.md).

The `wall-` files show the login wall as a logged-out reader meets it (viewport captures from `npm run e2e:wall`): the public Overview and Thesis, the header login pop-up, a gated tab, a shared project link and a comparison from the URL.
