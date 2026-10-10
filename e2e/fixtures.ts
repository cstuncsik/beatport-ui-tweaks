import { test as base, expect, type BrowserContext, type Worker } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const dist = fileURLToPath(new URL('../dist', import.meta.url))
export const featureIds = [
  'bp-ui-tweak-remember-last-played',
  'bp-ui-tweak-highlight-played-item',
  'bp-ui-tweak-next-prev-play-keyboard'
]

export type Options = { headlessMode: boolean }

export const test = base.extend<Options & { context: BrowserContext; worker: Worker; popupUrl: string }>({
  headlessMode: [true, { option: true }],
  context: async ({ playwright, headlessMode }, use) => {
    if (!existsSync(`${dist}/manifest.json`)) {
      throw new Error('dist/ is missing, run `pnpm build` first')
    }
    // Full Chromium, the headless shell cannot run extensions
    const context = await playwright.chromium.launchPersistentContext('', {
      headless: headlessMode,
      channel: 'chromium',
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`]
    })
    await use(context)
    await context.close()
  },
  worker: async ({ context }, use) => {
    const [worker] = context.serviceWorkers()
    await use(worker ?? (await context.waitForEvent('serviceworker')))
  },
  popupUrl: async ({ worker }, use) => {
    const manifest = JSON.parse(readFileSync(`${dist}/manifest.json`, 'utf8'))
    await use(`chrome-extension://${new URL(worker.url()).host}/${manifest.action.default_popup}`)
  }
})

export { expect }
