// Regenerates the Chrome Web Store screenshots in store-assets/ from the built extension:
// page-screenshot.jpg is the whole page with the popup open, extension-screenshot.jpg a close-up
// of the popup in the top right corner with part of the page around it. Both 1280x800.
// Needs `pnpm build` first. Opens a real browser window: Beatport serves its bot challenge to headless ones.
// playlist-filter-screenshot.jpg is not made here: it needs a logged-in account, so it is captured by hand
// from a 1280x800 window at 2x (picker open, a filter typed) and scaled down to 1280x800 with sharp.
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const assets = fileURLToPath(new URL('../store-assets/', import.meta.url))
const url = 'https://www.beatport.com/genre/drum-bass/1/tracks'
const scale = 2
const size = { width: 1280, height: 800 }

if (!existsSync(`${dist}/manifest.json`)) {
  console.error('dist/ is missing, run `pnpm build` first')
  process.exit(1)
}

const context = await chromium.launchPersistentContext('', {
  headless: false,
  channel: 'chromium',
  viewport: size,
  deviceScaleFactor: scale,
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`]
})

try {
  let [worker] = context.serviceWorkers()
  if (!worker) worker = await context.waitForEvent('serviceworker')

  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const rows = page.locator('.row').filter({ has: page.locator('button[data-testid="play-button"]') })
  await rows.first().waitFor({ timeout: 45_000 })
  // the consent banner renders late and would cover the bottom of the screenshot
  const consent = page.locator('button:has-text("I Accept"), #onetrust-accept-btn-handler').first()
  if (await consent.waitFor({ timeout: 8_000 }).then(() => true, () => false)) {
    await consent.click()
    await consent.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {})
  }
  await rows.nth(2).locator('button[data-testid="play-button"]').first().click()
  await rows.nth(2).locator(':scope.bp-ui-tweak-last-played__active').waitFor({ timeout: 15_000 })
  // Beatport slides a streaming promo into the player a few seconds into playback
  await page.addStyleTag({ content: '#bp-player [class*="banner-container"] { display: none !important }' })
  await page.mouse.move(size.width - 10, size.height / 2)
  await page.waitForTimeout(2500)
  const pageShot = await page.screenshot()

  const manifest = JSON.parse(readFileSync(`${dist}/manifest.json`, 'utf8'))
  const popup = await context.newPage()
  await popup.setViewportSize({ width: 320, height: 600 })
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/${manifest.action.default_popup}`)
  await popup.waitForSelector('.options li')
  await popup.waitForTimeout(300)
  await popup.setViewportSize({ width: 320, height: await popup.evaluate(() => document.body.scrollHeight) })
  const popupShot = await sharp(await popup.screenshot())
    .extend({ top: 2, bottom: 2, left: 2, right: 2, background: '#3a3a3a' })
    .png()
    .toBuffer()
  const { width: pw, height: ph } = await sharp(popupShot).metadata()

  const margin = 40 * scale
  const shadowBase = await sharp({
    create: { width: pw, height: ph, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.6 } }
  })
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const shadow = await sharp(shadowBase).blur(12 * scale).png().toBuffer()

  const left = size.width * scale - pw - 24 * scale
  const top = 16 * scale
  // sharp resizes before it composites, so compose at full size first, then scale down
  const composed = await sharp(pageShot)
    .composite([
      { input: shadow, left: left - margin, top: top - margin + 6 * scale },
      { input: popupShot, left, top }
    ])
    .png()
    .toBuffer()
  await sharp(composed).resize(size.width, size.height).jpeg({ quality: 92 }).toFile(`${assets}page-screenshot.jpg`)
  // close-up: the top right quarter at native 2x pixels, so the popup is shown twice as large
  await sharp(composed)
    .extract({ left: size.width * scale - size.width, top: 0, width: size.width, height: size.height })
    .jpeg({ quality: 92 })
    .toFile(`${assets}extension-screenshot.jpg`)

  console.log(`wrote ${assets}page-screenshot.jpg and extension-screenshot.jpg (${size.width}x${size.height})`)
} finally {
  await context.close()
}
