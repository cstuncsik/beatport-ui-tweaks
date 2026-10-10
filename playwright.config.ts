import { defineConfig } from '@playwright/test'
import type { Options } from './e2e/fixtures'

export default defineConfig<Options>({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'default', testIgnore: /live\.spec\.ts/, retries: process.env.CI ? 1 : 0 },
    { name: 'live', testMatch: /live\.spec\.ts/, timeout: 120_000, use: { headlessMode: false } }
  ]
})
