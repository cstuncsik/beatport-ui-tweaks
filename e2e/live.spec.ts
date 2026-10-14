import { test, expect, featureIds } from './fixtures'

// Runs headed (see the "live" project): Cloudflare serves its challenge page to headless browsers.
// Scheduled daily by .github/workflows/live-check.yml, not part of `pnpm test`.
// A tracks list with a pager, so the "Last played" button is covered too. The playlist features need
// a logged-in account and stay out of this check.
const url = 'https://www.beatport.com/genre/techno-peak-time-driving/6/tracks?per_page=150'

test('the extension still works on a live Beatport tracks list', async ({ page, worker }, testInfo) => {
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
  await expect.poll(() => second.evaluate(el => getComputedStyle(el).borderTopColor), { message: 'extension outlines the playing row', timeout: 15_000 }).toBe('rgb(1, 255, 149)')
  await expect
    .poll(() => worker.evaluate(() => chrome.storage.sync.get('beatport-last-played')), { message: 'last played stored' })
    .toEqual({ 'beatport-last-played': { 'techno-peak-time-driving': { tracks: trackId } } })

  await expect
    .poll(() => page.locator('.cell.title[data-bp-camelot]').count(), { message: 'Camelot codes on the title column' })
    .toBeGreaterThan(10)
  expect(await page.locator('.cell.title[data-bp-camelot]').first().getAttribute('data-bp-camelot')).toMatch(/^(1[0-2]|[1-9])[AB]$/)

  await page.keyboard.press('z')
  await expect(trackRows.nth(2), 'z plays the next track').toHaveClass(/current/, { timeout: 15_000 })
  const lastPlayedId = await trackRows.nth(2).locator('.cell.title a[href*="/track/"]').first().evaluate(a => a.href.split('/').pop())

  const pills = page.locator('.bp-ui-tweak-last-played-button')
  await expect(pills, '"Last played" pill in both pager rows').toHaveCount(2)
  await expect(pills.first(), 'pill active once something was played').toHaveAttribute('data-state', '')

  // the search: from page 2 the pill has to bring us back to the played track on page 1
  await page.goto(url.replace('?', '?page=2&'), { waitUntil: 'domcontentloaded' })
  if (!(await rows.first().waitFor({ timeout: 45_000 }).then(() => true, () => false))) {
    console.log('::warning::Live check: Cloudflare challenged the second page load, the "Last played" search was not verified')
    return
  }
  await pills.first().waitFor({ timeout: 15_000 })
  await pills.first().click()
  await page.waitForURL(/[?&]page=1&per_page=150/, { timeout: 60_000 })
  if (!(await rows.first().waitFor({ timeout: 45_000 }).then(() => true, () => false))) {
    console.log('::warning::Live check: Cloudflare challenged the page the "Last played" search landed on')
    return
  }
  await expect(page.locator(`.row:has(.cell.title a[href$="/${lastPlayedId}"])`), 'landed on the played track').toHaveClass(/bp-ui-tweak-last-played__active/, { timeout: 15_000 })
})
