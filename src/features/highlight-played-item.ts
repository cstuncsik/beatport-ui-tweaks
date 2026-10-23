import { ids } from './index'
import type { ContentFeature } from './types'
import { rowActiveClass, rowPlayingAttribute, rowPlayingSelector } from './selectors'

// Beatport outlines the row it plays through data-active and takes the marker off on a pause or stop.
// The extension's class follows the marker and stays, so the outline from content.scss survives the
// pause and the A/Z keys still know the row. Only changes are followed: at load the remembered row
// gets the class from remember-last-played.ts. Always on, the class draws nothing without the body
// class, so a toggle has nothing to do.
const id = ids.highlightPlaying

const followPlayingRow = () => {
  const playing = document.querySelector(rowPlayingSelector)
  if (playing && !playing.classList.contains(rowActiveClass)) {
    document.querySelectorAll(`.${rowActiveClass}`).forEach(row => row.classList.remove(rowActiveClass))
    playing.classList.add(rowActiveClass)
  }
}

export const highlightPlayedItem: ContentFeature = {
  id,
  start: () =>
    new MutationObserver(followPlayingRow).observe(document.documentElement, { attributes: true, attributeFilter: [rowPlayingAttribute], subtree: true })
}
