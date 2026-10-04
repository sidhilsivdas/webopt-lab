import { defineConfig } from '@playwright/test'

// Tests run against the production build: dev-mode React would skew the
// performance numbers. One worker, so tests never compete for CPU.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome', // the locally installed Chrome; no browser download needed
    viewport: { width: 1400, height: 1000 },
    locale: 'en-US',
    launchOptions: { args: ['--enable-precise-memory-info'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
