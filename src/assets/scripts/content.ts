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

const body = document.querySelector<HTMLElement>('body')!
const rowClass = 'row'
const rowActiveClass = 'bp-ui-tweak-last-played__active'
const rowActiveClassOriginal = 'current'
const playedItemBaseSelector = '.cell.title a'
const playOrReplayButtonSelector = 'button[data-testid="play-button"]'

let lastPlayed: HTMLElement | null = null
let scrolledToLastPlayed = false

const initializeActiveObserver = () => {
  if(body.classList.contains('bp-ui-tweak-highlight-played-item')) {
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

const mutationObserver = new MutationObserver(async () => {
  if(
    body.classList.contains('bp-ui-tweak-remember-last-played') &&
    !scrolledToLastPlayed
  ) {
    const { genreOrArtist, type } = getGenreOrArtistAndTypeFromUrl()
    const lastPlayedReleases = await getLastPlayedReleases()
    const { element } = await waitUntilElementIsVisible(
      `${ playedItemBaseSelector }[href$="/${ lastPlayedReleases[genreOrArtist]?.[type] }"]`
    )
    if (element) {
      lastPlayed = element
      const { top } = getOffset(lastPlayed, body)
      lastPlayed.closest(`.${ rowClass }`)?.classList.add(rowActiveClass, rowActiveClassOriginal)
      if (top && !scrolledToLastPlayed) {
        window.scrollTo({
          top: top - window.innerHeight / 2,
          behavior: 'smooth'
        })
        scrolledToLastPlayed = true
        mutationObserver.disconnect()
      }
    }
  }
})

body.classList.add('bp-ui-tweaks-extension')

mutationObserver.observe(body, { childList: true, subtree: true })
initializeActiveObserver()

body.addEventListener('click', async e => {
  if(body.classList.contains('bp-ui-tweak-remember-last-played')) {
    const target = e.target as HTMLElement
    const targetPlayBtn = target.matches(playOrReplayButtonSelector) ? target : target.closest(playOrReplayButtonSelector)
    if (targetPlayBtn) {
      const row = targetPlayBtn.closest(`.${rowClass}`)
      const releaseId = row?.querySelector<HTMLAnchorElement>(playedItemBaseSelector)?.href.split('/').pop()

      scrolledToLastPlayed = true
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

const syncCamelotObserver = observeWhileEnabled(camelotFeatureClass, annotateCamelotKeys)

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
  syncCamelotObserver()
  syncPlaylistFilter()
}

chrome.runtime.onMessage.addListener(request => {
  const {
    feature: { id, enabled }
  } = request
  toggleBodyFeatureClassNames(id, enabled)
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
