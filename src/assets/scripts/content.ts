import {
  findSiblingElementsByClasses,
  getOffset,
  toggleBodyFeatureClassNames,
  waitUntilElementIsVisible
} from './utils/dom'
import { Feature } from '../../store'
import { getGenreOrArtistAndTypeFromUrl } from './utils/url'
import { getLastPlayedReleases, lastPlayedStorageKey } from './utils/chrome'

const body = document.querySelector<HTMLElement>('body')!
const rowClass = 'row'
const rowActiveClass = 'bp-ui-tweak-last-played__active'
const rowActiveClassOriginal = 'current'
const playedItemBaseSelector = '.cell.title a'
const playOrReplayButtonSelector = 'button[data-testid="play-button"]'

let lastPlayed: HTMLElement | null = null
let scrolledToLastPlayed = false

let timeoutId: ReturnType<typeof setTimeout> | undefined | number
const mutationObserver = new MutationObserver(mutationList => {
  if(
    !body.classList.contains('bp-ui-tweak-remember-last-played') ||
    !mutationList.some(mutation => mutation.type === 'childList') ||
    scrolledToLastPlayed ||
    lastPlayed
  ) {
    return
  }

  clearTimeout(timeoutId)

  timeoutId = setTimeout(async () => {
    const { genreOrArtist, type } = getGenreOrArtistAndTypeFromUrl()
    const lastPlayedReleases = await getLastPlayedReleases()
    const { element } = await waitUntilElementIsVisible(
      `${playedItemBaseSelector}[href$="/${lastPlayedReleases[genreOrArtist]?.[type]}"]`
    )
    if (element) {
      lastPlayed = element
      const { top } = getOffset(lastPlayed, body)
      lastPlayed.closest(`.${rowClass}`)?.classList.add(rowActiveClass, rowActiveClassOriginal)
      if (top && !scrolledToLastPlayed) {
        window.scrollTo({
          top: top - window.innerHeight / 2,
          behavior: 'smooth'
        })
        scrolledToLastPlayed = true
      }
    }
  }, 100)
})

body.classList.add('bp-ui-tweaks-extension')

mutationObserver.observe(body, { childList: true, subtree: true })

body.addEventListener('click', async e => {
  const target = e.target as HTMLElement
  if (target.closest(playOrReplayButtonSelector) || target.matches(playOrReplayButtonSelector)) {
    const { genreOrArtist, type } = getGenreOrArtistAndTypeFromUrl()
    const lastPlayedReleases = await getLastPlayedReleases()
    const row = document.querySelector(
      `.${rowClass}.${rowActiveClassOriginal}:not(.${rowActiveClass}), .${rowClass}.${rowActiveClass}.${rowActiveClassOriginal}`
    )
    const releaseId = row?.querySelector<HTMLAnchorElement>(playedItemBaseSelector)?.href.split('/').pop()

    document.querySelector(`.${rowActiveClass}`)?.classList.remove(rowActiveClassOriginal)
    document.querySelectorAll(`.${rowClass}`).forEach(el => {
      el.classList.remove(rowActiveClass)
    })
    row?.classList.add(rowActiveClass)
    if (body.classList.contains('bp-ui-tweak-remember-last-played')) {
      scrolledToLastPlayed = true
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
})

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

chrome.runtime.onMessage.addListener(request => {
  const {
    feature: { id, enabled }
  } = request
  toggleBodyFeatureClassNames(id, enabled)
})

chrome.runtime.sendMessage({ action: 'get-beatport-ui-features' }, response => {
  const { features } = response
  features?.forEach((feature: Feature) => {
    const { id, enabled } = feature
    toggleBodyFeatureClassNames(id, enabled)
  })
})
