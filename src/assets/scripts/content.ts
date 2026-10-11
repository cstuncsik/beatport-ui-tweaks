import {
  findSiblingElementsByClasses,
  getOffset,
  observeWhileEnabled,
  toggleBodyFeatureClassNames,
  waitUntil,
  waitUntilElementIsVisible
} from './utils/dom'
import { Feature } from '../../store'
import { getGenreOrArtistAndTypeFromUrl } from './utils/url'
import { getLastPlayedReleases, lastPlayedStorageKey } from './utils/chrome'
import { camelotFromKeyText } from './utils/musical'
import { accessToken, findTrackPage, listParams } from './utils/beatport-api'

const body = document.querySelector<HTMLElement>('body')!
const rowClass = 'row'
const rowActiveClass = 'bp-ui-tweak-last-played__active'
const rowActiveClassOriginal = 'current'
const playedItemBaseSelector = '.cell.title a'
const playOrReplayButtonSelector = 'button[data-testid="play-button"]'

const rememberFeatureClass = 'bp-ui-tweak-remember-last-played'
const highlightFeatureClass = 'bp-ui-tweak-highlight-played-item'

let scrolledToLastPlayed = false
// the row marked on load; Beatport owns its "current" class again as soon as something is played
let markedRow: Element | null = null

const initializeActiveObserver = () => {
  if(body.classList.contains(highlightFeatureClass)) {
    const activeObserver = new MutationObserver(() => {
      document.querySelector(`.${rowActiveClass}`)?.classList.remove(rowActiveClass)

      const activeRow = document.querySelector(`.${ rowClass }.${ rowActiveClassOriginal }`)
      if (activeRow) {
        activeRow.classList.add(rowActiveClass)
        activeObserver.disconnect()
      }
    })
    activeObserver.observe(body, { childList: true, subtree: true })
  }
}

const scrollToLastPlayed = async () => {
  if (!body.classList.contains(rememberFeatureClass) || scrolledToLastPlayed) {
    return
  }
  const { genreOrArtist, type } = getGenreOrArtistAndTypeFromUrl()
  const lastPlayedReleases = await getLastPlayedReleases()
  const { element } = await waitUntilElementIsVisible(
    `${ playedItemBaseSelector }[href$="/${ lastPlayedReleases[genreOrArtist]?.[type] }"]`
  )
  // every DOM change starts one of these, so by now another one may have finished the job, or the
  // feature may have been switched off while waiting
  if (!element || !body.classList.contains(rememberFeatureClass) || scrolledToLastPlayed) {
    return
  }
  scrolledToLastPlayed = true
  mutationObserver.disconnect()
  markedRow = element.closest(`.${ rowClass }`)
  markedRow?.classList.add(rowActiveClass, rowActiveClassOriginal)
  const { top } = getOffset(element, body)
  if (top) {
    window.scrollTo({
      top: top - window.innerHeight / 2,
      behavior: 'smooth'
    })
  }
}

const mutationObserver = new MutationObserver(scrollToLastPlayed)

// "Last played" button next to Beatport's pager, in every pager row of a list: scrolls to the track
// played last in this list when it is on the page, otherwise asks the catalog API which page the
// track moved to and goes there. Part of the "remember last played" feature.
const lastPlayedButtonClass = 'bp-ui-tweak-last-played-button'
const lastPlayedLabel = 'Last played'
const pagerSelector = '[class*="Pager_container"].pages'
// Parcel turns this into the extension URL of the icon and lists it under web_accessible_resources
const lastPlayedIcon = new URL('../images/icon.png?width=36', import.meta.url).href

const storedLastPlayedId = async () => {
  const { genreOrArtist, type } = getGenreOrArtistAndTypeFromUrl()
  return (await getLastPlayedReleases())[genreOrArtist]?.[type]
}

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
  const id = await storedLastPlayedId()
  setLastPlayedButtons(lastPlayedLabel, id ? '' : 'empty')
  lastPlayedButtons().forEach(button => {
    button.title = id
      ? 'Beatport UI Tweaks: go to the page the track you played last in this list is on now'
      : 'Beatport UI Tweaks: nothing played in this list yet'
  })
}

const goToLastPlayed = async () => {
  const [button] = lastPlayedButtons()
  const id = await storedLastPlayedId()
  if (!button || button.dataset.state === 'busy' || !id) {
    return
  }
  const row = document.querySelector(`${playedItemBaseSelector}[href$="/${id}"]`)?.closest(`.${rowClass}`)
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
  const perPage = Number(url.searchParams.get('per_page')) || document.querySelectorAll(`.${rowClass} ${playOrReplayButtonSelector}`).length || 25
  setLastPlayedButtons('Searching…', 'busy')
  try {
    const token = await accessToken()
    const found = token ? await findTrackPage(id, params, perPage, token) : { reason: 'not-found' as const }
    if ('page' in found) {
      url.searchParams.set('page', String(found.page))
      url.searchParams.set('per_page', String(perPage))
      location.assign(url.href)
    } else {
      flashLastPlayedButtons(found.reason === 'unreachable' ? 'Too far back' : 'Not found')
    }
  } catch {
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

const syncLastPlayedButtons = observeWhileEnabled(rememberFeatureClass, ensureLastPlayedButtons, removeLastPlayedButtons)

// Switching a feature off in the popup puts the page back the way Beatport rendered it, switching
// it on applies the feature again right away. Camelot and the playlist filter do it through their
// observers, the playlist order through mru-playlists.ts watching the body class.
const featureToggles: Record<string, (enabled: boolean) => void> = {
  [rememberFeatureClass]: enabled => {
    if (enabled) {
      scrolledToLastPlayed = false
      mutationObserver.observe(body, { childList: true, subtree: true })
      scrollToLastPlayed()
    } else {
      markedRow?.classList.remove(rowActiveClass, rowActiveClassOriginal)
      markedRow = null
    }
  },
  [highlightFeatureClass]: enabled => {
    document.querySelectorAll(`.${rowActiveClass}`).forEach(row => row.classList.remove(rowActiveClass))
    if (enabled) {
      document.querySelector(`.${rowClass}.${rowActiveClassOriginal}`)?.classList.add(rowActiveClass)
      initializeActiveObserver()
    }
  }
}

body.classList.add('bp-ui-tweaks-extension')

mutationObserver.observe(body, { childList: true, subtree: true })
initializeActiveObserver()

body.addEventListener('click', async e => {
  if(body.classList.contains(rememberFeatureClass)) {
    const target = e.target as HTMLElement
    const targetPlayBtn = target.matches(playOrReplayButtonSelector) ? target : target.closest(playOrReplayButtonSelector)
    if (targetPlayBtn) {
      const row = targetPlayBtn.closest(`.${rowClass}`)
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
  }
  initializeActiveObserver()
}, true)

document.addEventListener('keyup', e => {
  const { key } = e
  // typing in a text field, Beatport's search or our playlist filter, must not drive the player
  if ((e.target as Element | null)?.closest('input, textarea, [contenteditable]')) {
    return
  }
  if (body.classList.contains('bp-ui-tweak-next-prev-play-keyboard')) {
    const currentRow = document.querySelector(`.${rowClass}.${rowActiveClassOriginal}`)
    const { prevElement, nextElement } = findSiblingElementsByClasses(currentRow, [rowClass])

    if (key === 'z') {
      nextElement?.querySelector<HTMLButtonElement>(playOrReplayButtonSelector)?.click()
    }

    if (key === 'a') {
      prevElement?.querySelector<HTMLButtonElement>(playOrReplayButtonSelector)?.click()
    }
  }
})

// Camelot key: the element that shows a musical key gets data-bp-camelot="10A", the chip itself is
// rendered by content.scss from that attribute, so React never sees an extra DOM node. In list
// tables the attribute goes on the title cell of the row instead, so the codes line up in one column.
const camelotFeatureClass = 'bp-ui-tweak-camelot-key'
const camelotAttribute = 'data-bp-camelot'

const chipTarget = (keyElement: Element): Element =>
  keyElement.matches('.cell.bpm > div') ? (keyElement.closest('.row')?.querySelector('.cell.title') ?? keyElement) : keyElement

const camelotKeyElements = (): Element[] => [
  // list tables on genre, chart, release and track pages: "86 BPM - D Minor", annotated rows are skipped
  ...[...document.querySelectorAll('.cell.bpm > div')].filter(div => !chipTarget(div).hasAttribute(camelotAttribute)),
  // track detail meta: <div>Key:</div><span>D Minor</span>
  ...[...document.querySelectorAll('[class*="metaItem"] > *')]
    .filter(label => label.textContent?.trim() === 'Key:')
    .map(label => label.nextElementSibling),
  // player bar: "A minor", changes with the track so it is re-read every pass
  ...document.querySelectorAll('#bp-player p')
].filter((element): element is Element => !!element)

const annotateCamelotKeys = () => {
  camelotKeyElements().forEach(element => {
    const code = camelotFromKeyText(element.textContent ?? '')
    const target = chipTarget(element)
    if (code) {
      if (target.getAttribute(camelotAttribute) !== code) {
        target.setAttribute(camelotAttribute, code)
      }
    } else if (target === element) {
      // a row's genre line has no key either, that must not strip the chip its key line put on the title cell
      target.removeAttribute(camelotAttribute)
    }
  })
}

const stripCamelotKeys = () =>
  document.querySelectorAll(`[${camelotAttribute}]`).forEach(element => element.removeAttribute(camelotAttribute))

const syncCamelotObserver = observeWhileEnabled(camelotFeatureClass, annotateCamelotKeys, stripCamelotKeys)

// Playlist filter: a search box in the header of the "add to playlist" picker, rows whose name does
// not contain every typed word get a hidden class. Beatport only has the first 50 playlists loaded,
// the rest come on scroll, so typing also pulls in the remaining pages through the picker's own
// scroll handler, which fires when the list sits exactly at its bottom.
const filterFeatureClass = 'bp-ui-tweak-playlist-filter'
const filterInputClass = 'bp-ui-tweak-playlist-filter__input'
const filterHiddenClass = 'bp-ui-tweak-playlist-filter__hidden'
const pickerSelector = '[class*="AddToPlaylistModal_wrapper"]'
let loadingPages = false

const pickerRows = (picker: Element) => [...picker.querySelectorAll('.item-row')]

const applyFilter = (picker: Element, input: HTMLInputElement) => {
  const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean)
  pickerRows(picker).forEach(row => {
    const name = row.querySelector('.name')?.textContent?.toLowerCase() ?? ''
    row.classList.toggle(filterHiddenClass, !terms.every(term => name.includes(term)))
  })
}

const loadRemainingPages = async (picker: Element) => {
  if (loadingPages) {
    return
  }
  loadingPages = true
  try {
    let scroller = picker.querySelector<HTMLElement>('.scrollable')
    while (scroller?.isConnected) {
      const before = pickerRows(picker).length
      const { scrollTop } = scroller
      // the handler reads the geometry during dispatch, restoring the position right after keeps the view still
      scroller.scrollTop = scroller.scrollHeight
      scroller.dispatchEvent(new Event('scroll'))
      scroller.scrollTop = scrollTop
      if (!(await waitUntil(() => pickerRows(picker).length > before, 2500))) {
        break
      }
      scroller = picker.querySelector<HTMLElement>('.scrollable')
    }
  } finally {
    loadingPages = false
  }
}

const createFilterInput = (picker: Element) => {
  const input = document.createElement('input')
  input.type = 'search'
  input.className = filterInputClass
  input.placeholder = 'Filter playlists'
  input.addEventListener('input', () => {
    applyFilter(picker, input)
    if (input.value.trim()) {
      loadRemainingPages(picker)
    }
  })
  return input
}

const ensureFilterInput = () => {
  const picker = document.querySelector(pickerSelector)
  const header = picker?.querySelector('[class*="TableHeader"]')
  if (!picker || !header) {
    return // picker closed, or on its create form: React drops the header and our box with it
  }
  let input = header.querySelector<HTMLInputElement>(`.${filterInputClass}`)
  if (!input) {
    const box = createFilterInput(picker)
    header.prepend(box)
    box.focus()
    // the modal's focus trap moves focus to its container a tick after opening, take it back once
    const retake = (event: FocusEvent) => {
      if (event.target !== box) {
        box.focus()
      }
    }
    document.addEventListener('focusin', retake, { once: true })
    setTimeout(() => document.removeEventListener('focusin', retake), 1000)
    input = box
  }
  applyFilter(picker, input)
}

const removeFilterInput = () => {
  document.querySelectorAll(`.${filterInputClass}`).forEach(input => input.remove())
  document.querySelectorAll(`.${filterHiddenClass}`).forEach(row => row.classList.remove(filterHiddenClass))
}

const syncPlaylistFilter = observeWhileEnabled(filterFeatureClass, ensureFilterInput, removeFilterInput)

const syncFeatureObservers = () => {
  syncLastPlayedButtons()
  syncCamelotObserver()
  syncPlaylistFilter()
}

chrome.runtime.onMessage.addListener(request => {
  const {
    feature: { id, enabled }
  } = request
  toggleBodyFeatureClassNames(id, enabled)
  featureToggles[id]?.(enabled)
  syncFeatureObservers()
})

chrome.runtime.sendMessage({ action: 'get-beatport-ui-features' }, response => {
  const { features } = response
  features?.forEach((feature: Feature) => {
    const { id, enabled } = feature
    toggleBodyFeatureClassNames(id, enabled)
  })
  syncFeatureObservers()
})
