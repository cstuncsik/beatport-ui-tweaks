import { test, expect, featureIds } from './fixtures'

// Runs headed (see the "live" project): Cloudflare serves its challenge page to headless browsers.
// Scheduled daily by .github/workflows/live-check.yml, not part of `pnpm test`.
const url = 'https://www.beatport.com/genre/techno-peak-time-driving/6/top-100'

test('the extension still works on the live Beatport top 100', async ({ page, worker }, testInfo) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const rows = page.locator('.row')
  const rendered = await rows.first().waitFor({ timeout: 45_000 }).then(() => true, () => false)
  if (!rendered) {
    const title = await page.title()
    await testInfo.attach('page', { body: await page.screenshot(), contentType: 'image/png' })
    if (/just a moment/i.test(title)) {
      console.log('::warning::Live check inconclusive, Cloudflare served its challenge page')
      test.skip(true, 'Cloudflare challenge page, markup not verified')
    }
    throw new Error(`No .row rendered within 45 s, page title "${title}"`)
  }

  const consent = page.locator('#onetrust-accept-btn-handler, button:has-text("I Accept")').first()
  if (await consent.isVisible().catch(() => false)) {
    await consent.click()
  }

  await expect(page.locator('body')).toHaveClass(/bp-ui-tweaks-extension/)
  for (const id of featureIds) {
    await expect(page.locator('body')).toHaveClass(new RegExp(id))
  }

  const trackRows = rows.filter({ has: page.locator('button[data-testid="play-button"]') })
  expect(await trackRows.count(), 'track rows with a play button').toBeGreaterThan(10)
  expect(await trackRows.locator('.cell.title a[href*="/track/"]').count(), 'track links inside rows').toBeGreaterThan(10)

  const second = trackRows.nth(1)
  const trackId = await second.locator('.cell.title a[href*="/track/"]').first().evaluate(a => a.href.split('/').pop())
  await second.locator('button[data-testid="play-button"]').first().click()
  await expect(second, 'Beatport marks the playing row').toHaveClass(/current/, { timeout: 15_000 })
  await expect(second, 'extension highlights the playing row').toHaveClass(/bp-ui-tweak-last-played__active/, { timeout: 15_000 })
  await expect
    .poll(() => worker.evaluate(() => chrome.storage.sync.get('beatport-last-played')), { message: 'last played stored' })
    .toEqual({ 'beatport-last-played': { 'techno-peak-time-driving': { 'top-100': trackId } } })

  await page.keyboard.press('z')
  await expect(trackRows.nth(2), 'z plays the next track').toHaveClass(/current/, { timeout: 15_000 })
})
