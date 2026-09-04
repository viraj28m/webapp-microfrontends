# e2e-parity — behavioural regression harness for the Angular migration

External Playwright suite that runs **unchanged** against the current Angular 14 app or a future
Angular 18 build. It does not import anything from the application; the only coupling is the URL.

Flows covered (deliberately small, high-value, read-only):

1. **Login** — demo credentials authenticate and land on `/home`; wrong password stays on `/login`.
2. **Application shell** — toolbar menus, expanded sidebar (identity + main items), Dashboard ↔ Home
   navigation, Institution menu → Clients page chrome.
3. **Accounting → Chart of Accounts** — landing headings, GL table columns/rows/account types,
   the read-only filter, and opening a single GL account detail page.

Every checkpoint saves a deterministically named screenshot (fixed 1366×900 viewport) and every
flow records "facts" (route reached, visible labels, row counts) into a comparison-friendly report.

## Setup

```bash
cd e2e-parity
npm install
npx playwright install chromium
```

## Run

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:4200` | App under test (Angular 14 or 18) |
| `RUN_LABEL` | `run` | Sub-folder under `results/` for this run |
| `MIFOS_USERNAME` / `MIFOS_PASSWORD` | `mifos` / `password` | Demo credentials |
| `FINERACT_SERVER` | *(app default)* | Optional backend to pick from the login page's server selector |

```bash
# Angular 14 baseline (app served on :4200)
RUN_LABEL=angular14 FINERACT_SERVER=https://dev.mifos.io npx playwright test

# Later: Angular 18 build served elsewhere
BASE_URL=http://localhost:4300 RUN_LABEL=angular18 FINERACT_SERVER=https://dev.mifos.io npx playwright test

# Compare the two runs
node scripts/compare.js angular14 angular18

# Render both runs (and the comparison) as an HTML dashboard
node scripts/dashboard.js angular14 angular18
(cd results && python3 -m http.server 4500)   # then open http://localhost:4500
```

Outputs per run: `results/<RUN_LABEL>/parity-report.{json,md}` and `results/<RUN_LABEL>/screenshots/*.png`.
The Playwright HTML report and traces (on failure) live in `results/<RUN_LABEL>/html-report` / `test-output`.

`compare.js` writes `results/compare-<a>-vs-<b>/report.{json,md}` plus `diffs/*.png`. It exits
non-zero only for **behavioural** differences (flow status or recorded facts). Pixel differences in
screenshots are reported with changed-pixel counts and diff images but are informational, since
Angular Material 18 is expected to shift styling.

`dashboard.js` writes `results/index.html`: per-run pass/fail cards with each flow's recorded facts
and checkpoint screenshots side by side, plus the behavioural comparison table. It reads the two
`parity-report.json` files and the comparison report, so it needs both runs to have completed. Serve
`results/` (not the file directly) so the screenshot paths resolve.

Use the same `FINERACT_SERVER` for both runs so backend data does not masquerade as a UI difference.

## Committed baseline

`results/angular14/` (report + screenshots) is the committed Angular 14 baseline, taken against
`https://dev.mifos.io` (tenant `default`). `html-report/` and `test-output/` are git-ignored.
