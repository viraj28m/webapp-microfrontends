import { Page, expect } from '@playwright/test';

export const CREDENTIALS = {
  username: process.env.MIFOS_USERNAME ?? 'mifos',
  password: process.env.MIFOS_PASSWORD ?? 'password',
};

/**
 * Optional Fineract backend to select on the login page (e.g.
 * https://dev.mifos.io). When unset the app's own default backend is used.
 */
export const FINERACT_SERVER = process.env.FINERACT_SERVER;

/**
 * Log in through the UI using user-facing selectors only (labels / roles /
 * visible text), then dismiss the post-login "Warning" dialog if shown.
 */
export async function login(page: Page) {
  await openLoginPage(page);
  await page.getByLabel('Username').fill(CREDENTIALS.username);
  await page.getByLabel('Password').fill(CREDENTIALS.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  await expect(page).toHaveURL(/\/home/);
  await dismissWarningDialog(page);
}

/**
 * The sidebar starts collapsed (icons only). Expand it via the toolbar toggle,
 * located by its user-visible tooltip, so its labels can be asserted.
 */
export async function expandSidebar(page: Page) {
  const sidebar = sidebarNav(page);
  if (await sidebar.getByText('Dashboard', { exact: true }).isVisible().catch(() => false)) return;
  const toggle = page.getByRole('button').first();
  await toggle.hover();
  await expect(page.getByText('Toggle Collapse').first()).toBeVisible();
  await toggle.click();
  await expect(sidebar.getByText('Dashboard', { exact: true })).toBeVisible();
}

/** The sidebar's main navigation list (identified by a stable menu label). */
export function sidebarNav(page: Page) {
  return page.getByRole('navigation').filter({ hasText: 'Checker Inbox and Tasks' });
}

/** Open /login and, if FINERACT_SERVER is set, pick it in the Server dropdown. */
export async function openLoginPage(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  if (FINERACT_SERVER) {
    await page.getByRole('combobox', { name: 'Server' }).click();
    await page.getByRole('option', { name: FINERACT_SERVER, exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Server' })).toContainText(FINERACT_SERVER);
  }
}

export async function dismissWarningDialog(page: Page) {
  const dialog = page.getByRole('dialog').filter({ hasText: 'authorized use only' });
  if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
  }
}
