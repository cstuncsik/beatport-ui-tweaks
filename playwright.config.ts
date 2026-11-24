import { defineConfig } from '@playwright/test'
import type { Options } from './e2e/fixtures'

export default defineConfig<Options>({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  // the JSON tells the live-check workflow a verified run from one Cloudflare skipped
  reporter: process.env.CI ? [['list'], ['github'], ['json', { outputFile: 'playwright-results.json' }]] : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'default', testIgnore: /live\.spec\.ts/, retries: process.env.CI ? 1 : 0 },
    { name: 'live', testMatch: /live\.spec\.ts/, timeout: 120_000, use: { headlessMode: false } }
  ]
})
