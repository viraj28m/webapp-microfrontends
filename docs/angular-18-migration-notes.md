# Angular 14 → 18 framework/toolchain migration notes

Phase 1 of the migration plan: workspace-wide framework/toolchain upgrade only.
Feature-level migration of `mifosx-lib` and login, flex-layout removal,
standalone components / signals / new control flow are deliberately out of scope.

## What changed

| Package | 14 baseline | now |
| --- | --- | --- |
| `@angular/*` core | 14.3.0 | 18.2.14 |
| `@angular/cli`, `@angular-devkit/*` | 14.2.x | 18.2.21 |
| `@angular/cdk`, `@angular/material` | 14.2.7 | 18.2.14 (MDC components) |
| `typescript` | 4.6.4 | 5.4.5 |
| `rxjs` | ~7.5 | ~7.8 |
| `zone.js` | 0.11.6 | 0.14.10 |
| `ng-packagr` | 14.2 | 18.2.1 |
| `@ngx-translate/core` / `http-loader` | 13 / 6 (View Engine, needed ngcc) | 15 / 8 (Ivy) |
| `@fortawesome/angular-fontawesome` | 0.11.1 | 0.15.0 |
| `ngx-mat-select-search` | 5.0.0 | 7.0.10 |
| `@swimlane/ngx-graph` | 8.x | 9.0.1 |
| `@angular-material-components/datetime-picker` | 8.0.0 | 16.0.1 (see blockers) |
| `@angular/flex-layout` | 14.0.0-beta.40 | 15.0.0-beta.42 (see blockers) |
| `jasmine-core` / `@types/node` | 4.3 / 12 | 5.1 / 20 |
| Dockerfile | node:19-alpine, cli 14.2.12 | node:20-alpine, cli 18.2.21 |

Removed: `tslint`, `codelyzer`, `protractor`, `@ngx-rocket/scripts`, `ngcc.config.js`.
Library peer deps (`projects/mifosx-lib`, `projects/fineract-client`): `^14.2.0` → `^18.0.0`.

Each major was applied with `ng update` one version at a time and the workspace
built at every step (15, 16, 17, 18). The Material MDC migration schematic
(`@angular/material:mdc-migration`) ran at v15 across all projects.

### Hand fixes required for compilation / runtime parity

- `ToolbarComponent.showPopover` — template refs on `mat-tab-link` now resolve to
  `MatTabLink` (component) instead of the element; accept it and use `.elementRef`.
- `MAT_FORM_FIELD_DEFAULT_OPTIONS` `appearance: 'standard'` → `'fill'` (`standard`
  no longer exists in MDC; it threw at runtime and blanked the login page).
- `<button mat-button mat-icon-button>` (6 places) → `mat-icon-button` only
  (`NG0300`, MDC made them separate components).
- `<nav mat-tab-nav-bar>` (17 places) now requires `[tabPanel]`; added an empty
  `<mat-tab-nav-panel #tabPanel>` next to each nav.
- Specs: `async()` from `@angular/core/testing` was removed in v16 → `waitForAsync()`
  (553 files, mechanical).
- The v18 "HttpClient provider functions" schematic (`HttpClientModule` →
  `provideHttpClient(withInterceptorsFromDi())`) was **reverted**: putting
  `provideHttpClient` in root providers overrode `CoreModule`'s
  `{ provide: HttpClient, useClass: HttpService }`, so the API-prefix/auth
  interceptor chain was bypassed. `HttpClientModule` is deprecated but still
  supported in v18 and preserves the original provider precedence.
- Optional `use-application-builder` migration was **not** applied (webpack
  browser builder kept) to avoid output-path / asset behaviour changes in this phase.

## Build / test results (Angular 18)

| Target | 14 baseline | 18 |
| --- | --- | --- |
| `ng build fineract-client` | ok | ok |
| `ng build mifosx-lib` | **fails** NG3003 import cycle (`shell.component` ↔ `public-api` via `footer.component`) | same failure, unchanged |
| `ng build mifosx-app --configuration development` | ok | ok |
| `ng build mifosx-app` (production) | fails budget: initial 7.6 MB > 1 MB error budget | same failure (8.3 MB) |
| `ng test mifosx-app` | compiles after 2 spec import fixes; 0 specs run — `environment.ts` reads `window.env` (env.js not loaded in Karma) | same |
| `ng test mifosx-lib` | 4 pre-existing spec compile errors (pipe constructor args, bad import path) | same |

Comparator (`tools/compare`, mocked Fineract API, see `tools/compare/README.md`):
login page, validation, not-found and logged-out redirect flows render and behave
the same; login submit reaches home with the same sidenav items and the same
API call sequence. Screenshots differ ~8% on login pages purely from the MDC
form-field restyle (fill appearance, floating label spacing).

## Remaining issues for later phases

1. **`mifosx-lib` ng-packagr build (NG3003)** — pre-existing import cycle; fix in
   the `mifosx-lib` phase (break `footer.component` → `public-api` import).
2. **Production budget** — `initial` 1 MB error budget is far exceeded on 14 and 18
   alike; needs lazy loading or a budget change (out of scope per plan).
3. **Unit tests don't execute** — `projects/mifosx-lib/src/environments/environment.ts`
   dereferences `window['env']` at import time; Karma has no `env.js`. Pre-existing.
4. **`@angular/flex-layout`** is EOL (last release targets Angular 15); it still
   compiles/runs against 18 with `--legacy-peer-deps`. Tailwind/CSS rewrite is a
   later phase.
5. **`@angular-material-components/datetime-picker@16`** is unmaintained and has
   `^16` peers; runs on 18 but should be replaced (e.g. `@ng-matero/extensions`).
6. `npm install` currently requires `--legacy-peer-deps` because of 4 and 5
   (Dockerfile updated accordingly).
7. Material M2 theming API is now `mat.m2-*` (migrated by schematic); `define-light-theme`
   emits a warning about the theme map shape — cosmetic, fix during the styling phase.
8. Visual: MDC form fields (`fill` appearance) look different from the legacy
   `standard` underline fields; a UX pass is expected in the login/lib phases.
