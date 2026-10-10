import {
  findSiblingElementsByClasses,
  getOffset,
  toggleBodyFeatureClassNames,
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

// Camelot key: every element that shows a musical key gets data-bp-camelot="10A", the chip itself
// is rendered by content.scss from that attribute, so React never sees an extra DOM node.
const camelotFeatureClass = 'bp-ui-tweak-camelot-key'
const camelotAttribute = 'data-bp-camelot'
let camelotObserver: MutationObserver | null = null
let camelotFrame = 0

const camelotKeyElements = (): Element[] => [
  // list tables on genre, chart, release and track pages: "86 BPM - D Minor"
  ...document.querySelectorAll(`.cell.bpm > div:not([${camelotAttribute}])`),
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
    if (code) {
      if (element.getAttribute(camelotAttribute) !== code) {
        element.setAttribute(camelotAttribute, code)
      }
    } else if (element.hasAttribute(camelotAttribute)) {
      element.removeAttribute(camelotAttribute)
    }
  })
}

const scheduleCamelotPass = () => {
  if (!camelotFrame) {
    camelotFrame = requestAnimationFrame(() => {
      camelotFrame = 0
      annotateCamelotKeys()
    })
  }
}

const syncCamelotObserver = () => {
  const enabled = body.classList.contains(camelotFeatureClass)
  if (enabled && !camelotObserver) {
    camelotObserver = new MutationObserver(scheduleCamelotPass)
    // attribute changes are not observed, so our own writes never re-trigger the pass
    camelotObserver.observe(body, { childList: true, subtree: true, characterData: true })
    scheduleCamelotPass()
  }
  if (!enabled && camelotObserver) {
    camelotObserver.disconnect()
    camelotObserver = null
  }
}

chrome.runtime.onMessage.addListener(request => {
  const {
    feature: { id, enabled }
  } = request
  toggleBodyFeatureClassNames(id, enabled)
  syncCamelotObserver()
})

chrome.runtime.sendMessage({ action: 'get-beatport-ui-features' }, response => {
  const { features } = response
  features?.forEach((feature: Feature) => {
    const { id, enabled } = feature
    toggleBodyFeatureClassNames(id, enabled)
  })
  syncCamelotObserver()
})
