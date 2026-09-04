import { test, expect } from '@playwright/test';
import { CREDENTIALS, dismissWarningDialog, openLoginPage } from '../helpers/auth';
import { checkpoint, expectRoute, parityFact } from '../helpers/checkpoint';

test.describe('Login', () => {
  test('login page renders and demo credentials authenticate', async ({ page }, testInfo) => {
    await openLoginPage(page);
    await expectRoute(page, testInfo, '/login');

    const username = page.getByLabel('Username');
    const password = page.getByLabel('Password');
    const loginButton = page.getByRole('button', { name: 'Login', exact: true });

    await expect(username).toBeVisible();
    await expect(password).toBeVisible();
    await expect(page.getByRole('img', { name: /logo/i }).first()).toBeVisible();
    await expect(loginButton).toBeDisabled();
    parityFact(testInfo, 'login-button-disabled-when-empty', true);
    await checkpoint(page, testInfo, 'login page');

    await username.fill(CREDENTIALS.username);
    await password.fill(CREDENTIALS.password);
    await expect(loginButton).toBeEnabled();
    await loginButton.click();

    await expectRoute(page, testInfo, '/home');
    await checkpoint(page, testInfo, 'post-login warning dialog');
    await dismissWarningDialog(page);

    await expect(page.getByText(`Welcome, ${CREDENTIALS.username}!`)).toBeVisible();
    parityFact(testInfo, 'welcome-banner', `Welcome, ${CREDENTIALS.username}!`);
    await checkpoint(page, testInfo, 'home after login');
  });

  test('login page layout: cover panel shown on desktop, hidden on phones', async ({ page }, testInfo) => {
    await openLoginPage(page);
    const cover = page.getByRole('heading', { name: 'Mifos X' }).first();
    const loginButton = page.getByRole('button', { name: 'Login', exact: true });

    // Desktop: cover (left) and form (right) side by side.
    await expect(cover).toBeVisible();
    const [coverBox, formBox] = await Promise.all([cover.boundingBox(), loginButton.boundingBox()]);
    expect(coverBox && formBox && formBox.x > coverBox.x).toBe(true);
    await expect(page.getByRole('button', { name: 'Resources' })).toBeVisible();
    parityFact(testInfo, 'login-cover-visible-desktop', true);

    // Phone width: cover and resources links hidden, form still usable.
    await page.setViewportSize({ width: 480, height: 900 });
    await expect(cover).toBeHidden();
    await expect(page.getByRole('button', { name: 'Resources' })).toBeHidden();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(loginButton).toBeVisible();
    parityFact(testInfo, 'login-cover-hidden-phone', true);
    await checkpoint(page, testInfo, 'login page phone');
  });

  test('wrong password is rejected and user stays on login', async ({ page }, testInfo) => {
    await openLoginPage(page);
    await page.getByLabel('Username').fill(CREDENTIALS.username);
    await page.getByLabel('Password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click();

    // Stays on /login and no authenticated shell is shown.
    await page.waitForTimeout(3_000);
    await expectRoute(page, testInfo, '/login');
    await expect(page.getByText(/Welcome,/)).toHaveCount(0);
    await checkpoint(page, testInfo, 'rejected login');
  });
});
