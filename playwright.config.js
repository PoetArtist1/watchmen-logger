/**
 * Playwright config — UI tests for the monitoring Signal Desk (RF-03 / RF-07).
 * @see TESTING.md
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    trace: 'on-first-retry',
    baseURL: 'http://127.0.0.1:3851'
  },
  webServer: {
    command: 'node tests/ui/fixtures/ui-server.js',
    url: 'http://127.0.0.1:3851/api/monitoring/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
