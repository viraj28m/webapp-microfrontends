import { test, expect } from '@playwright/test';
import { expandSidebar, login, sidebarNav } from '../helpers/auth';
import { checkpoint, expectRoute, parityFact } from '../helpers/checkpoint';

/**
 * Read-only financial workflow: Accounting -> Chart of Accounts.
 * Only reads GL accounts; never creates/edits anything.
 */
test.describe('Accounting: Chart of Accounts (read-only)', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('navigate to Chart of Accounts and verify GL account listing', async ({ page }, testInfo) => {
    await page.getByRole('link', { name: 'Accounting', exact: true }).click();
    await expectRoute(page, testInfo, '/accounting');
    for (const entry of ['Chart of Accounts', 'Create Journal Entries', 'Search Journal Entries', 'Closing Entries', 'Accounting Rules']) {
      await expect(page.getByRole('heading', { name: entry, exact: true })).toBeVisible();
    }
    await checkpoint(page, testInfo, 'accounting landing');

    await page.getByRole('heading', { name: 'Chart of Accounts', exact: true }).click();
    await expectRoute(page, testInfo, '/accounting/chart-of-accounts');

    const table = page.getByRole('table');
    for (const col of ['Account', 'GL Code', 'Type', 'Disabled', 'Manual Entries Allowed', 'Used as']) {
      await expect(table.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
    }
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    parityFact(testInfo, 'gl-accounts-rows-on-first-page', rowCount);

    // Account types shown in the table are the canonical GL types.
    const types = new Set(await table.locator('tbody tr td:nth-child(3)').allInnerTexts());
    const known = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
    for (const t of types) expect(known).toContain(t.trim().toUpperCase());
    parityFact(testInfo, 'gl-account-types-seen', [...types].map((t) => t.trim()).sort().join(', '));
    await checkpoint(page, testInfo, 'chart of accounts list');

    // Filter narrows the list (client-side, read-only).
    const firstAccount = (await rows.first().locator('td').first().innerText()).trim();
    await page.getByLabel('Filter').fill(firstAccount);
    await expect(rows.first().locator('td').first()).toContainText(firstAccount);
    expect(await rows.count()).toBeLessThanOrEqual(rowCount);
    await checkpoint(page, testInfo, 'chart of accounts filtered');
  });

  test('view a single GL account (read-only detail page)', async ({ page }, testInfo) => {
    // "Frequently Accessed" shortcut in the sidebar.
    await expandSidebar(page);
    await sidebarNav(page).getByText('Chart of Accounts', { exact: true }).click();
    await expectRoute(page, testInfo, '/accounting/chart-of-accounts');
    const firstRow = page.getByRole('table').locator('tbody tr').first();
    await expect(firstRow).toBeVisible();
    const name = (await firstRow.locator('td').nth(0).innerText()).trim();
    const glCode = (await firstRow.locator('td').nth(1).innerText()).trim();
    await firstRow.click();

    await expect(page).toHaveURL(/\/accounting\/chart-of-accounts\/gl-accounts\/view\/\d+$/);
    parityFact(testInfo, 'route:/accounting/chart-of-accounts/gl-accounts/view/:id', true);
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(glCode, { exact: false }).first()).toBeVisible();
    parityFact(testInfo, 'first-gl-account', `${glCode} ${name}`);
    await checkpoint(page, testInfo, 'gl account detail');
  });
});
