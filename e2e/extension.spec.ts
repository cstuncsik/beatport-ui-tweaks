import { test, expect, featureIds } from './fixtures'
import type { Page, Worker } from '@playwright/test'

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

// the popup sends this exact message when a toggle flips; no "tabs" permission, so tab urls are
// hidden: broadcast, tabs without the content script reject
const toggleFeature = (worker: Worker, id: string, enabled: boolean) =>
  worker.evaluate(
    async ({ id, enabled }) => {
      const tabs = await chrome.tabs.query({})
      await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id!, { feature: { id, enabled } })))
    },
    { id, enabled }
  )

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

test('recently used playlists lead the add-to-playlist list', async ({ page }) => {
  // Beatport's picker pages through /v4/my/playlists/ with axios over XMLHttpRequest, which the
  // extension patches in the page's world. Same origin as the stub page here, so no CORS in the way.
  const playlist = (id: number) => ({ id, name: `Playlist ${id}`, track_count: 1 })
  const pages: Record<string, unknown> = {
    '1': { page: '1/2', count: 3, results: [playlist(1), playlist(2)] },
    '2': { page: '2/2', count: 3, results: [playlist(3)] }
  }
  await visitTrackList(page)
  await page.route('https://www.beatport.com/v4/**', route => {
    const url = new URL(route.request().url())
    return route.fulfill({ json: url.pathname === '/v4/my/playlists/' ? pages[url.searchParams.get('page') ?? '1'] : {} })
  })
  await expect(page.locator('body')).toHaveClass(/bp-ui-tweak-mru-playlists/)
  const xhr = (method: string, path: string, body?: string) =>
    page.evaluate(
      ([method, path, body]) =>
        new Promise<unknown>(resolve => {
          const request = new XMLHttpRequest()
          request.open(method, `/v4/my/playlists/${path}`)
          request.onload = () => resolve(JSON.parse(request.responseText))
          request.send(body)
        }),
      [method, path, body] as [string, string, string | undefined]
    )
  const list = async (pageNumber: number) =>
    ((await xhr('GET', `?page=${pageNumber}&per_page=50`)) as { results: ReturnType<typeof playlist>[] }).results
  const ids = async (pageNumber: number) => (await list(pageNumber)).map(({ id }) => id)

  expect(await ids(1)).toEqual([1, 2])
  expect(await ids(2)).toEqual([3])
  // Beatport's React Query client as the extension finds it: through the fiber chain of a page node
  await page.evaluate(
    pages => {
      const calls: unknown[] = []
      const client = {
        getQueryCache: () => ({}),
        setQueryData: (key: unknown, updater: (data: unknown) => unknown) => calls.push([key, updater({ pages, pageParams: [1, 2] })])
      }
      Object.assign(document.querySelector('#bp-player')!, { __reactFiber$test: { memoizedProps: {}, return: { memoizedProps: { client }, return: null } } })
      Object.assign(window, { __queryCalls: calls })
    },
    [pages['1'], pages['2']]
  )
  await xhr('POST', '3/tracks/bulk/', JSON.stringify({ track_ids: [10, 11] }))
  expect(await list(1), 'used playlist moves to the top with its count bumped').toEqual([{ ...playlist(3), track_count: 3 }, playlist(1), playlist(2)])
  expect(await ids(2), 'and leaves its own page').toEqual([])
  expect(await page.evaluate(() => (window as unknown as { __queryCalls: unknown[] }).__queryCalls), 'cached pages get the new order at once').toEqual([
    [
      ['my-playlists-infinite'],
      {
        pages: [
          { page: '1/2', count: 3, results: [{ ...playlist(3), track_count: 3 }, playlist(1), playlist(2)] },
          { page: '2/2', count: 3, results: [] }
        ],
        pageParams: [1, 2]
      }
    ]
  ])
  await xhr('POST', '2/tracks/bulk/', JSON.stringify({ track_ids: [12] }))
  expect(await ids(1), 'latest use first, the previous top is second').toEqual([2, 3, 1])

  await page.reload()
  await expect(page.locator('body')).toHaveClass(/bp-ui-tweak-mru-playlists/)
  expect(await ids(1), 'survives a reload').toEqual([2, 3, 1])
  await xhr('DELETE', '3/')
  expect(await ids(1), 'a deleted playlist is forgotten').toEqual([2, 1])
})

test('filter box in the add-to-playlist picker narrows the list as you type', async ({ page, worker }) => {
  await visitTrackList(page)
  await renderRows(page, ['111', '222'])
  // Stand-in for Beatport's picker: header with the create button, and a scrollable list that
  // appends the next page when scrolled to its very bottom, like the real infinite scroll does.
  const row = (name: string) => `<div class="item-row"><span class="name">${name}</span></div>`
  await page.evaluate(
    ([firstPage, secondPage]) => {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div class="AddToPlaylistModal_wrapper__x">
          <div class="PlaylistTable-style__TableHeader-x"><button type="button">Create playlist</button></div>
          <div class="scrollable" style="height: 40px; overflow-y: auto">${firstPage}</div>
        </div>`
      )
      // Beatport's focus trap moves focus to the modal container a tick after it opened
      const modal = document.querySelector<HTMLElement>('[class*="AddToPlaylistModal_wrapper"]')!
      modal.tabIndex = -1
      setTimeout(() => modal.focus(), 0)
      const list = document.querySelector<HTMLElement>('.scrollable')!
      list.addEventListener('scroll', () => {
        if (list.scrollTop + list.clientHeight === list.scrollHeight && !list.dataset.loaded) {
          list.dataset.loaded = '1'
          setTimeout(() => list.insertAdjacentHTML('beforeend', secondPage), 100)
        }
      })
    },
    [row('DnB dark club') + row('Techno peak') + row('Deep house'), row('Dark ambient') + row('Liquid DnB')]
  )
  const input = page.locator('.bp-ui-tweak-playlist-filter__input')
  const shown = page.locator('.item-row:not(.bp-ui-tweak-playlist-filter__hidden) .name')
  await expect(input, 'box is in the header, ready to type').toBeFocused()
  await expect(shown).toHaveText(['DnB dark club', 'Techno peak', 'Deep house'])

  await input.fill('dark')
  await expect(shown, 'matches from the page loaded while typing too').toHaveText(['DnB dark club', 'Dark ambient'])
  await input.fill('dnb dark')
  await expect(shown, 'every word has to match').toHaveText(['DnB dark club'])
  await input.press('z')
  await input.press('a')
  await expect(rows(page).nth(0), 'typing does not drive the player').toHaveClass(/current/)
  await input.fill('')
  await expect(shown).toHaveCount(5)

  await input.fill('ambient')
  await toggleFeature(worker, 'bp-ui-tweak-playlist-filter', false)
  await expect(input).toHaveCount(0)
  await expect(shown, 'off: box gone, nothing hidden').toHaveCount(5)
  await toggleFeature(worker, 'bp-ui-tweak-playlist-filter', true)
  await expect(input).toBeFocused()
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

  const toggle = (enabled: boolean) => toggleFeature(worker, 'bp-ui-tweak-camelot-key', enabled)
  await toggle(false)
  await expect(page.locator('body')).not.toHaveClass(/bp-ui-tweak-camelot-key/)
  expect(await chip(keyCell(0))).toEqual(['none', ''])
  await renderRows(page, ['444'])
  await expect(keyCell(0), 'no annotation while off').not.toHaveAttribute('data-bp-camelot', /./)
  await toggle(true)
  await expect(keyCell(0)).toHaveAttribute('data-bp-camelot', '7A')
  expect(await chip(keyCell(0))).toEqual(['"7A"', '-15'])
})
