import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Behavioural-parity harness for the Mifos web app.
 *
 * Everything that differs between runs is driven by environment variables so
 * the exact same suite can be pointed at Angular 14 today and Angular 18 later:
 *
 *   BASE_URL   - app under test (default http://localhost:4200)
 *   RUN_LABEL  - human label for this run, used as the results folder name
 *                (e.g. angular14, angular18). Default: "run"
 *   MIFOS_USERNAME / MIFOS_PASSWORD - demo credentials (default mifos/password)
 */
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4200';
export const RUN_LABEL = process.env.RUN_LABEL ?? 'run';
export const RESULTS_DIR = path.join(__dirname, 'results', RUN_LABEL);
export const SCREENSHOT_DIR = path.join(RESULTS_DIR, 'screenshots');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  outputDir: path.join(RESULTS_DIR, 'test-output'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(RESULTS_DIR, 'html-report'), open: 'never' }],
    ['./helpers/parity-reporter.ts'],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    // Fixed viewport so screenshots are pixel-comparable across runs.
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium' }],
});
