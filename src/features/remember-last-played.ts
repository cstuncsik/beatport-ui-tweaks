import { ids } from './index'
import type { ContentFeature } from './types'
import { playedItemBaseSelector, playButtonSelector, rowActiveClass, rowClass } from './selectors'
import { observeWhileEnabled, waitUntil, waitUntilElementIsVisible } from '../assets/scripts/utils/dom'
import { getGenreOrArtistAndTypeFromUrl } from '../assets/scripts/utils/url'
import { getLastPlayedReleases, lastPlayedStorageKey } from '../assets/scripts/utils/chrome'
import { accessToken, findTrackPage, listParams } from '../assets/scripts/utils/beatport-api'

// Remembers the track played last per list, scrolls to it and marks it when the list is opened again,
// and puts a "Last played" button next to Beatport's pager that finds the page the track moved to.
const id = ids.rememberLastPlayed
const enabled = () => document.body.classList.contains(id)

let scrolledToLastPlayed = false
// the row marked on load; a play moves the class on (highlight-played-item.ts), the toggle takes it off
let markedRow: Element | null = null

const storedLastPlayedId = async () => {
  const { genreOrArtist, type } = getGenreOrArtistAndTypeFromUrl()
  return (await getLastPlayedReleases())[genreOrArtist]?.[type]
}

const scrollToLastPlayed = async () => {
  if (!enabled() || scrolledToLastPlayed) {
    return
  }
  const { element } = await waitUntilElementIsVisible(`${playedItemBaseSelector}[href$="/${await storedLastPlayedId()}"]`)
  // every DOM change starts one of these, so by now another one may have finished the job, or the
  // feature may have been switched off while waiting
  if (!element || !enabled() || scrolledToLastPlayed) {
    return
  }
  scrolledToLastPlayed = true
  mutationObserver.disconnect()
  markedRow = element.closest(`.${rowClass}`)
  markedRow?.classList.add(rowActiveClass)
  // Beatport renders lists on the server, so the row is there before the page finished loading, and
  // until then the browser restores the scroll position of the last visit over any scroll of ours
  await waitUntil(() => document.readyState === 'complete', 30_000)
  if (enabled()) {
    markedRow?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

const mutationObserver = new MutationObserver(scrollToLastPlayed)

const storePlayedTrack = async (event: Event) => {
  if (!enabled()) {
    return
  }
  const target = event.target as HTMLElement
  const playButton = target.matches(playButtonSelector) ? target : target.closest(playButtonSelector)
  if (!playButton) {
    return
  }
  const row = playButton.closest(`.${rowClass}`)
  const releaseId = row?.querySelector<HTMLAnchorElement>(playedItemBaseSelector)?.href.split('/').pop()

  scrolledToLastPlayed = true
  markedRow = null
  const { genreOrArtist, type } = getGenreOrArtistAndTypeFromUrl()
  const lastPlayedReleases = await getLastPlayedReleases()
  await chrome.storage.sync.set({
    [lastPlayedStorageKey]: {
      ...lastPlayedReleases,
      [genreOrArtist]: {
        ...lastPlayedReleases[genreOrArtist],
        [type]: releaseId
      }
    }
  })
  refreshLastPlayedButtons()
}

// "Last played" button next to Beatport's pager, in every pager row of a list: scrolls to the track
// played last in this list when it is on the page, otherwise asks the catalog API which page the
// track moved to and goes there.
const lastPlayedButtonClass = 'bp-ui-tweak-last-played-button'
const lastPlayedLabel = 'Last played'
const pagerSelector = '[class*="Pager_container"].pages'
// Parcel turns this into the extension URL of the icon and lists it under web_accessible_resources
const lastPlayedIcon = new URL('../assets/images/icon.png?width=36', import.meta.url).href

const lastPlayedButtons = () => [...document.querySelectorAll<HTMLButtonElement>(`.${lastPlayedButtonClass}`)]

const setLastPlayedButtons = (label: string, state: '' | 'empty' | 'busy' = '') =>
  lastPlayedButtons().forEach(button => {
    button.querySelector('span')!.textContent = label
    button.dataset.state = state
  })

const flashLastPlayedButtons = (label: string) => {
  setLastPlayedButtons(label)
  setTimeout(() => setLastPlayedButtons(lastPlayedLabel), 2500)
}

const refreshLastPlayedButtons = async () => {
  const trackId = await storedLastPlayedId()
  setLastPlayedButtons(lastPlayedLabel, trackId ? '' : 'empty')
  lastPlayedButtons().forEach(button => {
    button.title = trackId
      ? 'Beatport UI Tweaks: go to the page the track you played last in this list is on now'
      : 'Beatport UI Tweaks: nothing played in this list yet'
  })
}

const goToLastPlayed = async () => {
  const [button] = lastPlayedButtons()
  const trackId = await storedLastPlayedId()
  if (!button || button.dataset.state === 'busy' || !trackId) {
    return
  }
  const row = document.querySelector(`${playedItemBaseSelector}[href$="/${trackId}"]`)?.closest(`.${rowClass}`)
  if (row) {
    row.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }
  const params = listParams()
  if (!params) {
    flashLastPlayedButtons('Only for newest first')
    return
  }
  const url = new URL(location.href)
  const perPage = Number(url.searchParams.get('per_page')) || document.querySelectorAll(playedItemBaseSelector).length || 25
  setLastPlayedButtons('Searching…', 'busy')
  try {
    const token = await accessToken()
    const found = token ? await findTrackPage(trackId, params, perPage, token) : { reason: 'not-found' as const }
    if ('page' in found) {
      url.searchParams.set('page', String(found.page))
      url.searchParams.set('per_page', String(perPage))
      location.assign(url.href)
    } else {
      flashLastPlayedButtons(found.reason === 'unreachable' ? 'Too far back' : 'Not found')
    }
  } catch (error) {
    console.warn('Beatport UI Tweaks: the "Last played" search failed', error)
    flashLastPlayedButtons('Search failed')
  }
}

const createLastPlayedButton = () => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = lastPlayedButtonClass
  button.dataset.state = 'empty'
  const image = document.createElement('img')
  image.src = lastPlayedIcon
  image.alt = ''
  const label = document.createElement('span')
  label.textContent = lastPlayedLabel
  button.append(image, label)
  button.addEventListener('click', goToLastPlayed)
  return button
}

const ensureLastPlayedButtons = () => {
  let added = false
  document.querySelectorAll(pagerSelector).forEach(pager => {
    if (!pager.previousElementSibling?.classList.contains(lastPlayedButtonClass)) {
      pager.before(createLastPlayedButton())
      added = true
    }
  })
  if (added) {
    refreshLastPlayedButtons()
  }
}

const removeLastPlayedButtons = () => lastPlayedButtons().forEach(button => button.remove())

const syncLastPlayedButtons = observeWhileEnabled(id, ensureLastPlayedButtons, removeLastPlayedButtons)

export const rememberLastPlayed: ContentFeature = {
  id,
  start: () => document.body.addEventListener('click', storePlayedTrack, true),
  toggle: enabled => {
    syncLastPlayedButtons()
    if (enabled) {
      scrolledToLastPlayed = false
      mutationObserver.observe(document.body, { childList: true, subtree: true })
      scrollToLastPlayed()
    } else {
      markedRow?.classList.remove(rowActiveClass)
      markedRow = null
    }
  }
}
