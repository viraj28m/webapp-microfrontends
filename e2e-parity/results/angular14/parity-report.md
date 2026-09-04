# Parity report: angular14

- Base URL: http://localhost:4200
- Started: 2026-09-04T15:00:08.300Z
- Result: **9/9 passed**, 0 failed, 0 skipped

| Flow | Status | Duration |
|---|---|---|
| authenticated shell renders toolbar, sidebar and user identity | passed | 8.0s |
| Institution menu exposes Clients / Groups / Centers and opens Clients | passed | 7.9s |
| login page layout: cover panel shown on desktop, hidden on phones | passed | 6.4s |
| login page renders and demo credentials authenticate | passed | 8.8s |
| navigate to Chart of Accounts and verify GL account listing | passed | 9.5s |
| sidebar navigation to Dashboard and back Home | passed | 8.0s |
| sidebar opens Navigation and office drill-down renders the detail card | passed | 9.1s |
| view a single GL account (read-only detail page) | passed | 8.7s |
| wrong password is rejected and user stays on login | passed | 9.8s |

## authenticated shell renders toolbar, sidebar and user identity

| Fact | Value |
|---|---|
| sidebar-identity | default / mifos |
| sidebar-main-items | Dashboard, Navigation, Checker Inbox and Tasks, Notifications |
| toolbar-menus | Institution, Accounting, Reports, Admin |

| Checkpoint | Route | Screenshot |
|---|---|---|
| home shell collapsed sidebar | /home | screenshots/authenticated-shell-renders-toolbar-sidebar-and-user-identity--home-shell-collapsed-sidebar.png |
| home shell expanded sidebar | /home | screenshots/authenticated-shell-renders-toolbar-sidebar-and-user-identity--home-shell-expanded-sidebar.png |

## Institution menu exposes Clients / Groups / Centers and opens Clients

| Fact | Value |
|---|---|
| clients-page-actions | Search, Import Client, Create Client |
| route:/clients | true |

| Checkpoint | Route | Screenshot |
|---|---|---|
| institution menu open | /home | screenshots/institution-menu-exposes-clients-groups-centers-and-opens-clients--institution-menu-open.png |
| clients list | /clients | screenshots/institution-menu-exposes-clients-groups-centers-and-opens-clients--clients-list.png |

## login page layout: cover panel shown on desktop, hidden on phones

| Fact | Value |
|---|---|
| login-cover-hidden-phone | true |
| login-cover-visible-desktop | true |

| Checkpoint | Route | Screenshot |
|---|---|---|
| login page phone | /login | screenshots/login-page-layout-cover-panel-shown-on-desktop-hidden-on-phones--login-page-phone.png |

## login page renders and demo credentials authenticate

| Fact | Value |
|---|---|
| login-button-disabled-when-empty | true |
| route:/home | true |
| route:/login | true |
| welcome-banner | Welcome, mifos! |

| Checkpoint | Route | Screenshot |
|---|---|---|
| login page | /login | screenshots/login-page-renders-and-demo-credentials-authenticate--login-page.png |
| post-login warning dialog | /home | screenshots/login-page-renders-and-demo-credentials-authenticate--post-login-warning-dialog.png |
| home after login | /home | screenshots/login-page-renders-and-demo-credentials-authenticate--home-after-login.png |

## navigate to Chart of Accounts and verify GL account listing

| Fact | Value |
|---|---|
| gl-account-types-seen | ASSET, EQUITY, EXPENSE, INCOME, LIABILITY |
| gl-accounts-rows-on-first-page | 10 |
| route:/accounting | true |
| route:/accounting/chart-of-accounts | true |

| Checkpoint | Route | Screenshot |
|---|---|---|
| accounting landing | /accounting | screenshots/navigate-to-chart-of-accounts-and-verify-gl-account-listing--accounting-landing.png |
| chart of accounts list | /accounting/chart-of-accounts | screenshots/navigate-to-chart-of-accounts-and-verify-gl-account-listing--chart-of-accounts-list.png |
| chart of accounts filtered | /accounting/chart-of-accounts | screenshots/navigate-to-chart-of-accounts-and-verify-gl-account-listing--chart-of-accounts-filtered.png |

## sidebar navigation to Dashboard and back Home

| Fact | Value |
|---|---|
| route:/dashboard | true |
| route:/home | true |

| Checkpoint | Route | Screenshot |
|---|---|---|
| dashboard | /dashboard | screenshots/sidebar-navigation-to-dashboard-and-back-home--dashboard.png |

## sidebar opens Navigation and office drill-down renders the detail card

| Fact | Value |
|---|---|
| navigation-office-detail-card | true |
| navigation-stacked-narrow | true |
| navigation-two-columns-desktop | true |
| route:/navigation | true |

| Checkpoint | Route | Screenshot |
|---|---|---|
| navigation page | /navigation | screenshots/sidebar-opens-navigation-and-office-drill-down-renders-the-detail-card--navigation-page.png |
| office selected | /navigation | screenshots/sidebar-opens-navigation-and-office-drill-down-renders-the-detail-card--office-selected.png |
| office selected narrow | /navigation | screenshots/sidebar-opens-navigation-and-office-drill-down-renders-the-detail-card--office-selected-narrow.png |

## view a single GL account (read-only detail page)

| Fact | Value |
|---|---|
| first-gl-account | 000112 Book Cash Account |
| route:/accounting/chart-of-accounts | true |
| route:/accounting/chart-of-accounts/gl-accounts/view/:id | true |

| Checkpoint | Route | Screenshot |
|---|---|---|
| gl account detail | /accounting/chart-of-accounts/gl-accounts/view/930 | screenshots/view-a-single-gl-account-read-only-detail-page--gl-account-detail.png |

## wrong password is rejected and user stays on login

| Fact | Value |
|---|---|
| route:/login | true |

| Checkpoint | Route | Screenshot |
|---|---|---|
| rejected login | /login | screenshots/wrong-password-is-rejected-and-user-stays-on-login--rejected-login.png |
