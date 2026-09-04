import { test, expect } from '@playwright/test';
import { expandSidebar, login, sidebarNav } from '../helpers/auth';
import { checkpoint, expectRoute, parityFact } from '../helpers/checkpoint';

/**
 * The /navigation page (office -> officer -> center -> group -> client
 * drill-down). Layout facts are asserted at the desktop viewport and at a
 * narrow one so the two-column -> single-column responsive behaviour is
 * covered independently of the layout library implementing it.
 */
test.describe('Navigation page', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('sidebar opens Navigation and office drill-down renders the detail card', async ({ page }, testInfo) => {
    await expandSidebar(page);
    await sidebarNav(page).getByText('Navigation', { exact: true }).click();
    await expectRoute(page, testInfo, '/navigation');

    const officeSelect = page.getByRole('combobox', { name: 'Office' });
    await expect(officeSelect).toBeVisible();
    await checkpoint(page, testInfo, 'navigation page');

    // Selecting an office shows its detail card in the second column.
    await officeSelect.click();
    const firstOffice = page.getByRole('option').first();
    const officeName = (await firstOffice.textContent())!.trim();
    await firstOffice.click();
    const detailCard = page.locator('mifosx-office-navigation');
    await expect(detailCard).toBeVisible();
    await expect(detailCard.getByRole('heading', { name: officeName })).toBeVisible();
    await expect(detailCard.getByText('Opened On')).toBeVisible();
    await expect(detailCard.getByText('Number of Staff')).toBeVisible();
    parityFact(testInfo, 'navigation-office-detail-card', true);

    // Desktop: selector card and detail card sit side by side.
    const [selectorBox, detailBox] = await Promise.all([
      page.locator('mifosx-navigation mat-card').first().boundingBox(),
      detailCard.boundingBox(),
    ]);
    expect(selectorBox && detailBox && detailBox.x > selectorBox.x + selectorBox.width).toBe(true);
    parityFact(testInfo, 'navigation-two-columns-desktop', true);
    await checkpoint(page, testInfo, 'office selected');

    // Narrow viewport: columns stack vertically.
    await page.setViewportSize({ width: 800, height: 900 });
    const [selectorNarrow, detailNarrow] = await Promise.all([
      page.locator('mifosx-navigation mat-card').first().boundingBox(),
      detailCard.boundingBox(),
    ]);
    expect(selectorNarrow && detailNarrow && detailNarrow.y >= selectorNarrow.y + selectorNarrow.height).toBe(true);
    parityFact(testInfo, 'navigation-stacked-narrow', true);
    await checkpoint(page, testInfo, 'office selected narrow');
  });
});
