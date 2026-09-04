import { test, expect } from '@playwright/test';
import { CREDENTIALS, expandSidebar, login, sidebarNav } from '../helpers/auth';
import { checkpoint, expectRoute, parityFact } from '../helpers/checkpoint';

const SIDEBAR_ITEMS = ['Dashboard', 'Navigation', 'Checker Inbox and Tasks', 'Notifications'];
const TOOLBAR_MENUS = ['Institution', 'Accounting', 'Reports', 'Admin'];

test.describe('Application shell', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('authenticated shell renders toolbar, sidebar and user identity', async ({ page }, testInfo) => {
    // Toolbar: top-level menus are visible.
    const toolbar = page.getByRole('navigation').filter({ hasText: 'Institution' });
    for (const menu of TOOLBAR_MENUS) {
      await expect(toolbar.getByText(menu, { exact: true })).toBeVisible();
    }
    parityFact(testInfo, 'toolbar-menus', TOOLBAR_MENUS.join(', '));

    // Sidebar (collapsed by default): expand, then check identity + main items.
    await checkpoint(page, testInfo, 'home shell collapsed sidebar');
    await expandSidebar(page);
    await expect(page.getByText(`default / ${CREDENTIALS.username}`)).toBeVisible();
    parityFact(testInfo, 'sidebar-identity', `default / ${CREDENTIALS.username}`);
    await expect(page.getByText('Frequently Accessed')).toBeVisible();
    await expect(page.getByText('Main Items')).toBeVisible();
    const sidebar = sidebarNav(page);
    for (const item of SIDEBAR_ITEMS) {
      await expect(sidebar.getByText(item, { exact: true })).toBeVisible();
    }
    parityFact(testInfo, 'sidebar-main-items', SIDEBAR_ITEMS.join(', '));
    await checkpoint(page, testInfo, 'home shell expanded sidebar');
  });

  test('sidebar navigation to Dashboard and back Home', async ({ page }, testInfo) => {
    await expandSidebar(page);
    await sidebarNav(page).getByText('Dashboard', { exact: true }).click();
    await expectRoute(page, testInfo, '/dashboard');
    await checkpoint(page, testInfo, 'dashboard');

    // App brand in the sidebar returns to home.
    await page.getByRole('img', { name: 'app-logo' }).click();
    await expectRoute(page, testInfo, '/home');
  });

  test('Institution menu exposes Clients / Groups / Centers and opens Clients', async ({ page }, testInfo) => {
    await page.getByText('Institution', { exact: true }).click();
    const menu = page.getByRole('menu');
    for (const item of ['Clients', 'Groups', 'Centers']) {
      await expect(menu.getByRole('menuitem', { name: item, exact: true })).toBeVisible();
    }
    await checkpoint(page, testInfo, 'institution menu open');

    await menu.getByRole('menuitem', { name: 'Clients', exact: true }).click();
    await expectRoute(page, testInfo, '/clients');
    // Page chrome that does not depend on backend data (the demo backends
    // differ in which client-search API they expose).
    await expect(page.getByRole('list').filter({ hasText: 'Clients' })).toContainText('Home');
    await expect(page.getByRole('textbox', { name: /Search by client name/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Client' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import Client' })).toBeVisible();
    parityFact(testInfo, 'clients-page-actions', 'Search, Import Client, Create Client');
    await checkpoint(page, testInfo, 'clients list');
  });
});
