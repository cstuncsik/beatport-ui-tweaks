import { getOffset } from './utils/dom'
import { Feature } from '../../store'

const body = document.querySelector<HTMLElement>('body')!
const rowClass = 'bucket-item'
const rowActiveClass = `${rowClass}__active`
const releasePlayBtnClass = 'playable-play'
const lastPalayedStorageKey = `beatport-last-played`

const getLastPlayedReleases = () => JSON.parse(localStorage.getItem(lastPalayedStorageKey) || '')
const setLastPlayedGenres = (genres: Record<string, string>) =>
  localStorage.setItem(lastPalayedStorageKey, JSON.stringify(genres))
const getGenreOrArtistFromUrl = () => location.pathname.replace(/\/(genre|artist)\/(.*?)\/.*?$/, '$2')

let timeoutId: ReturnType<typeof setTimeout> | undefined | number
const mutationObserver = new MutationObserver(mutationList => {
  for (const mutation of mutationList) {
    if (mutation.type === 'childList') {
      clearTimeout(timeoutId)

      timeoutId = setTimeout(() => {
        const genreOrArtist = getGenreOrArtistFromUrl()
        const lastPalayedReleases = getLastPlayedReleases()
        const lastPlayedBtn = document.querySelector<HTMLElement>(
          `.${releasePlayBtnClass}[data-id="${lastPalayedReleases[genreOrArtist]}"]`
        )
        if (lastPlayedBtn && body.classList.contains('bp-ui-tweak-remember-last-played')) {
          const { top } = getOffset(lastPlayedBtn, body)
          lastPlayedBtn.closest(`.${rowClass}`)?.classList.add(rowActiveClass)
          if (top) {
            window.scrollTo({
              top: top - window.innerHeight / 2,
              behavior: 'smooth'
            })
          }
        }
      }, 250)
    }
  }
})

body.classList.add('bp-ui-tweaks-extension')

mutationObserver.observe(body, { childList: true })

body.addEventListener('click', e => {
  const target = e.target as HTMLElement
  if (target.classList.contains(releasePlayBtnClass)) {
    const row = target.closest(`.${rowClass}`)
    if (row && row.contains(target)) {
      const genreOrArtist = getGenreOrArtistFromUrl()
      const lastPalayedReleases = getLastPlayedReleases()

      document.querySelectorAll(`.${rowClass}`).forEach(el => {
        el.classList.remove(rowActiveClass)
      })
      row.classList.add(rowActiveClass)
      if (body.classList.contains('bp-ui-tweak-remember-last-played')) {
        setLastPlayedGenres({ ...lastPalayedReleases, [genreOrArtist]: target.dataset.id })
      }
    }
  }
})

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  const {
    feature: { id, enabled }
  } = request
  if (enabled) {
    body.classList.add(id)
  } else {
    body.classList.remove(id)
  }
})

chrome.runtime.sendMessage({ action: 'get-beatport-ui-features' }, response => {
  console.log(response)
  const { features } = response
  features?.forEach((feature: Feature) => {
    const { id, enabled } = feature
    if (enabled) {
      body.classList.add(id)
    } else {
      body.classList.remove(id)
    }
  })
})
