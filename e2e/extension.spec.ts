import { test, expect, featureIds } from './fixtures'
import type { Page } from '@playwright/test'

const siteUrl = 'https://www.beatport.com/genre/techno/6/top-100'

// Stand-in for a Beatport track list. The content script relies on .row, .cell.title a[href]
// and button[data-testid="play-button"]. Like the real site (a SPA) rows are rendered after
// load, which is also what wakes the extension's MutationObserver. Clicking play marks the
// row as .current, as Beatport's player does.
const keys = ['D Minor', 'Bb Minor', 'Eb Major']

const trackRow = (id: string, current: boolean, key: string) => `
  <div class="row${current ? ' current' : ''}">
    <div class="cell title"><a href="/release/track-${id}/${id}">Track ${id}</a></div>
    <div class="cell bpm"><div>Drum &amp; Bass</div><div>86 BPM - ${key}</div></div>
    <button data-testid="play-button"
      onclick="document.querySelector('.row.current')?.classList.remove('current');this.closest('.row').classList.add('current');this.dataset.played=1">
      play
    </button>
  </div>`

const visitTrackList = async (page: Page) => {
  await page.route('https://www.beatport.com/**', route =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <div class="TrackMeta_metaItem__x1"><div>BPM<!-- -->:</div><span>86</span></div>
        <div class="TrackMeta_metaItem__x1"><div>Key<!-- -->:</div><span>Gb Minor</span></div>
        <main id="list"></main>
        <div id="bp-player"><p>87 bpm</p><p>A minor</p></div>`
    })
  )
  await page.goto(siteUrl)
  await expect(page.locator('body')).toHaveClass(/bp-ui-tweak-next-prev-play-keyboard/)
}

const renderRows = (page: Page, ids: string[]) =>
  page.locator('#list').evaluate((list, html) => {
    list.innerHTML = html
  }, ids.map((id, i) => trackRow(id, i === 0, keys[i % keys.length])).join(''))

const rows = (page: Page) => page.locator('.row')

test('popup lists the default features and persists a toggle', async ({ page, popupUrl }) => {
  await page.goto(popupUrl)
  const boxes = page.locator('.options input[type="checkbox"]')
  await expect(boxes).toHaveCount(featureIds.length)
  for (const box of await boxes.all()) {
    await expect(box).toBeChecked()
  }
  await page.getByText('Remember last played').click()
  await page.reload()
  await expect(boxes.first()).not.toBeChecked()
  await expect(boxes.nth(1)).toBeChecked()
})

test('the popup shortcut command is registered', async ({ worker }) => {
  // the key itself is not asserted: headless Chrome on Linux registers the command but binds no key
  const commands = await worker.evaluate(() => chrome.commands.getAll())
  expect(commands.map(command => command.name), 'commands from the manifest').toContain('_execute_action')
})

test('content script initializes and receives the enabled features', async ({ page }) => {
  await visitTrackList(page)
  await expect(page.locator('body')).toHaveClass(/bp-ui-tweaks-extension/)
  for (const id of featureIds) {
    await expect(page.locator('body')).toHaveClass(new RegExp(id))
  }
})

test('remembers the last played track and highlights it after reload', async ({ page, worker }) => {
  await visitTrackList(page)
  await renderRows(page, ['111', '222', '333'])
  await rows(page).nth(1).getByTestId('play-button').click()
  await expect
    .poll(() => worker.evaluate(() => chrome.storage.sync.get('beatport-last-played')))
    .toEqual({ 'beatport-last-played': { techno: { 'top-100': '222' } } })

  await page.reload()
  await expect(page.locator('body')).toHaveClass(/bp-ui-tweak-remember-last-played/)
  await renderRows(page, ['111', '222', '333'])
  await expect(rows(page).nth(1)).toHaveClass(/bp-ui-tweak-last-played__active/)
  await expect(rows(page).nth(0)).not.toHaveClass(/bp-ui-tweak-last-played__active/)
})

test('highlights the row that is playing', async ({ page }) => {
  await visitTrackList(page)
  await renderRows(page, ['111', '222'])
  await rows(page).nth(1).getByTestId('play-button').click()
  // the observer reacts to the next DOM change, on the real site the player re-renders constantly
  await page.locator('#list').evaluate(list => list.append(document.createElement('div')))
  await expect(rows(page).nth(1)).toHaveClass(/bp-ui-tweak-last-played__active/)
})

test('z and a keys play the next and previous track', async ({ page }) => {
  await visitTrackList(page)
  await renderRows(page, ['111', '222', '333'])
  await page.keyboard.press('z')
  await expect(rows(page).nth(1)).toHaveClass(/current/)
  await expect(rows(page).nth(1).getByTestId('play-button')).toHaveAttribute('data-played', '1')
  await page.keyboard.press('z')
  await expect(rows(page).nth(2)).toHaveClass(/current/)
  await page.keyboard.press('a')
  await expect(rows(page).nth(1)).toHaveClass(/current/)
})

test('shows wheel-colored Camelot codes next to every key, toggle hides them', async ({ page, worker }) => {
  await visitTrackList(page)
  await renderRows(page, ['111', '222', '333'])
  const keyCell = (row: number) => rows(page).nth(row).locator('.cell.bpm > div').nth(1)
  const chip = (locator: ReturnType<typeof keyCell>) =>
    locator.evaluate(el => [getComputedStyle(el, '::after').content, getComputedStyle(el).getPropertyValue('--bp-camelot-hue').trim()])

  await expect(keyCell(0)).toHaveAttribute('data-bp-camelot', '7A')
  await expect(keyCell(1)).toHaveAttribute('data-bp-camelot', '3A')
  await expect(keyCell(2)).toHaveAttribute('data-bp-camelot', '5B')
  await expect(rows(page).nth(0).locator('.cell.bpm > div').nth(0), 'genre cell gets no code').not.toHaveAttribute('data-bp-camelot', /./)
  await expect(page.locator('[class*="metaItem"]:has-text("Key:") > span'), 'track detail key').toHaveAttribute('data-bp-camelot', '11A')
  await expect(page.locator('[class*="metaItem"]:has-text("BPM:") > span'), 'track detail bpm').not.toHaveAttribute('data-bp-camelot', /./)
  await expect(page.locator('#bp-player p').nth(1), 'player key').toHaveAttribute('data-bp-camelot', '8A')
  await expect(page.locator('#bp-player p').nth(0), 'player bpm').not.toHaveAttribute('data-bp-camelot', /./)
  expect(await chip(keyCell(0))).toEqual(['"7A"', '-15'])
  expect(await chip(keyCell(2))).toEqual(['"5B"', '45'])

  // next track in the player: text changes, code follows
  await page.locator('#bp-player p').nth(1).evaluate(p => { p.textContent = 'Eb Major' })
  await expect(page.locator('#bp-player p').nth(1)).toHaveAttribute('data-bp-camelot', '5B')

  // the popup sends this exact message when the toggle flips
  const toggle = (enabled: boolean) =>
    worker.evaluate(async enabled => {
      // no "tabs" permission, so tab urls are hidden: broadcast, tabs without the content script reject
      const tabs = await chrome.tabs.query({})
      await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id!, { feature: { id: 'bp-ui-tweak-camelot-key', enabled } })))
    }, enabled)
  await toggle(false)
  await expect(page.locator('body')).not.toHaveClass(/bp-ui-tweak-camelot-key/)
  expect(await chip(keyCell(0))).toEqual(['none', ''])
  await renderRows(page, ['444'])
  await expect(keyCell(0), 'no annotation while off').not.toHaveAttribute('data-bp-camelot', /./)
  await toggle(true)
  await expect(keyCell(0)).toHaveAttribute('data-bp-camelot', '7A')
  expect(await chip(keyCell(0))).toEqual(['"7A"', '-15'])
})
