import { getOffset, toggleBodyFeatureClassNames, waitUntilElementIsVisible } from './utils/dom'
import { Feature } from '../../store'
import { getGenreOrArtistFromUrl } from './utils/url'
import { getLastPlayedReleases, lastPlayedStorageKey } from './utils/chrome'

const body = document.querySelector<HTMLElement>('body')!
const rowClass = 'row'
const rowActiveClass = 'bp-ui-tweak-last-played__active'
const rowActiveClassOriginal = 'current'
let scrolledToLastPlayed = false

let timeoutId: ReturnType<typeof setTimeout> | undefined | number
const mutationObserver = new MutationObserver(mutationList => {
  for (const mutation of mutationList) {
    if (mutation.type === 'childList' && body.classList.contains('bp-ui-tweak-remember-last-played')) {
      clearTimeout(timeoutId)

      timeoutId = setTimeout(async () => {
        const genreOrArtist = getGenreOrArtistFromUrl()
        const lastPlayedReleases = await getLastPlayedReleases()
        const { element: lastPlayedBtn } = await waitUntilElementIsVisible(
          `a[href$="/${lastPlayedReleases[genreOrArtist]}"]`
        )
        if (lastPlayedBtn) {
          const { top } = getOffset(lastPlayedBtn, body)
          lastPlayedBtn.closest(`.${rowClass}`)?.classList.add(rowActiveClass, rowActiveClassOriginal)
          if (top && !scrolledToLastPlayed) {
            window.scrollTo({
              top: top - window.innerHeight / 2,
              behavior: 'smooth'
            })
            scrolledToLastPlayed = true
          }
        }
      }, 100)
    }
  }
})

body.classList.add('bp-ui-tweaks-extension')

mutationObserver.observe(body, { childList: true, subtree: true })

body.addEventListener('click', async e => {
  const target = e.target as HTMLElement
  const row = target.closest(`.${rowClass}`)
  const button = target.closest('button')
  if (row?.contains(target) && button?.querySelector('svg[title="Play"]')) {
    const genreOrArtist = getGenreOrArtistFromUrl()
    const lastPlayedReleases = await getLastPlayedReleases()
    const releaseId = row.querySelector<HTMLLinkElement>('a')?.href.split('/').pop()

    document.querySelectorAll(`.${rowClass}`).forEach(el => {
      el.classList.remove(rowActiveClass)
    })
    row.classList.add(rowActiveClass)
    if (body.classList.contains('bp-ui-tweak-remember-last-played')) {
      scrolledToLastPlayed = true
      await chrome.storage.sync.set({
        [lastPlayedStorageKey]: { ...lastPlayedReleases, [genreOrArtist]: releaseId }
      })
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
