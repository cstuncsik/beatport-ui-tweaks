import { test, expect, featureIds } from './fixtures'
import type { Page } from '@playwright/test'

const siteUrl = 'https://www.beatport.com/genre/techno/6/top-100'

// Stand-in for a Beatport track list. The content script relies on .row, .cell.title a[href]
// and button[data-testid="play-button"]. Like the real site (a SPA) rows are rendered after
// load, which is also what wakes the extension's MutationObserver. Clicking play marks the
// row as .current, as Beatport's player does.
const trackRow = (id: string, current: boolean) => `
  <div class="row${current ? ' current' : ''}">
    <div class="cell title"><a href="/release/track-${id}/${id}">Track ${id}</a></div>
    <button data-testid="play-button"
      onclick="document.querySelector('.row.current')?.classList.remove('current');this.closest('.row').classList.add('current');this.dataset.played=1">
      play
    </button>
  </div>`

const visitTrackList = async (page: Page) => {
  await page.route('https://www.beatport.com/**', route =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><main id="list"></main>' })
  )
  await page.goto(siteUrl)
  await expect(page.locator('body')).toHaveClass(/bp-ui-tweak-next-prev-play-keyboard/)
}

const renderRows = (page: Page, ids: string[]) =>
  page.locator('#list').evaluate((list, html) => {
    list.innerHTML = html
  }, ids.map((id, i) => trackRow(id, i === 0)).join(''))

const rows = (page: Page) => page.locator('.row')

test('popup lists the default features and persists a toggle', async ({ page, popupUrl }) => {
  await page.goto(popupUrl)
  const boxes = page.locator('.options input[type="checkbox"]')
  await expect(boxes).toHaveCount(3)
  for (const box of await boxes.all()) {
    await expect(box).toBeChecked()
  }
  await page.getByText('Remember last played').click()
  await page.reload()
  await expect(boxes.first()).not.toBeChecked()
  await expect(boxes.nth(1)).toBeChecked()
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
