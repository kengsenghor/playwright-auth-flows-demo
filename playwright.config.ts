/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const isCI = process.env.CI === 'true';
// Lists skipped / known-issue / flaky tests so a green run cannot hide unverified gaps (see the reporter's header).
const summaryReporter = './e2e-tests/reporters/run-summary.reporter.ts';

export default defineConfig({
  testDir: './e2e-tests/specs',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/results.xml' }], [summaryReporter]]
    : [['list'], ['html', { open: 'never' }], [summaryReporter]],
  use: {
    // Failure evidence: kept only when a test fails, so green runs stay light.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
