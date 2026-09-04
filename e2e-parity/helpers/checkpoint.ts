import { Page, TestInfo, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { SCREENSHOT_DIR } from '../playwright.config';

/**
 * Capture a named, deterministic screenshot at a meaningful checkpoint.
 *
 * File name is `<flow>--<checkpoint>.png` (no test-run hash), so the same
 * checkpoint from two different runs (angular14 vs angular18) lands at the
 * same relative path and can be diffed by `scripts/compare.js`.
 *
 * The screenshot is also attached to the Playwright report and its route
 * recorded as an annotation so the parity reporter can list it.
 */
export async function checkpoint(page: Page, testInfo: TestInfo, name: string) {
  const flow = slug(testInfo.title);
  const file = `${flow}--${slug(name)}.png`;
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const fullPath = path.join(SCREENSHOT_DIR, file);

  // Let Angular Material animations/ripples settle before capturing.
  await page.waitForTimeout(400);
  await page.screenshot({ path: fullPath, fullPage: false, animations: 'disabled', caret: 'hide' });

  await testInfo.attach(name, { path: fullPath, contentType: 'image/png' });
  testInfo.annotations.push({
    type: 'checkpoint',
    description: JSON.stringify({ name, file, route: routeOf(page) }),
  });
}

/** Record a user-visible fact that should hold in both framework versions. */
export function parityFact(testInfo: TestInfo, key: string, value: string | number | boolean) {
  testInfo.annotations.push({ type: 'fact', description: JSON.stringify({ key, value }) });
}

/** Assert the app is on a given route (path only; ignores host and query). */
export async function expectRoute(page: Page, testInfo: TestInfo, pathname: string) {
  await expect(page).toHaveURL((url) => url.pathname === pathname || url.hash === `#${pathname}`);
  parityFact(testInfo, `route:${pathname}`, true);
}

export function routeOf(page: Page): string {
  const u = new URL(page.url());
  return u.hash ? u.hash.replace(/^#/, '') : u.pathname;
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
