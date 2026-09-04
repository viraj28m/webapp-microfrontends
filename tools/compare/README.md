# Comparator harness

Captures a behavioural snapshot of the workspace so that a migration step
(framework bump, library rewrite, flex-layout removal, …) can be checked for
regressions without a running Fineract backend.

```
tools/compare/capture.sh baseline                 # on the commit you are migrating from
tools/compare/capture.sh after                    # on your branch
node tools/compare/compare.js tools/compare/snapshots/baseline tools/compare/snapshots/after
```

`SKIP_TESTS=1 tools/compare/capture.sh <label>` skips the Karma runs.

## What a snapshot contains

| File | Produced by | Compared how |
|---|---|---|
| `build.json`, `build-*.log`, `test-*.log` | `ng build` of `fineract-client`, `mifosx-lib`, `mifosx-app` (development config) and `ng test` per project | status ok/failed must not regress |
| `inventory.json` | `inventory.js` – static scan: component/directive/pipe selectors, NgModule and Injectable names per project, every `path:` in `*-routing.module.ts`, translation key sets, library `public-api.ts` exports | exact equality |
| `runtime.json`, `*.png` | `capture.js` – serves `dist/mifosx-app` and drives it with puppeteer against the mocked API in `fixtures/api.js` | per-scenario DOM summary must be equal; screenshots are pixel-diffed (`*.diff.png` written when > threshold) |

Runtime scenarios: login page render, required-field validation, password
visibility toggle, successful login → `#/home` (credentials persisted, API
calls made), sidenav, unknown route → not-found, cleared storage → redirect to
login. Console errors are recorded per scenario and any *increase* fails the
comparison.

External requests (Google Fonts, the real Fineract host) are blocked so the
capture is deterministic and offline. Only `/fineract-provider/**` is answered,
from `fixtures/api.js`.

Exit code of `compare.js` is `1` when any behavioural difference is found.
Pixel differences alone are reported but do not fail — visual changes are an
expected outcome of the Angular Material MDC migration and must be reviewed by
a human via the generated `*.diff.png` files.

`snapshots/baseline/` is the Angular 14 snapshot (commit `33d657b`) and is
committed; other snapshots are git-ignored.
