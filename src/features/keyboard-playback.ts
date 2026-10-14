import { ids } from './index'
import type { ContentFeature } from './types'
import { playOrReplayButtonSelector, rowActiveClassOriginal, rowClass } from './selectors'
import { findSiblingElementsByClasses } from '../assets/scripts/utils/dom'

// A plays the previous track, Z the next one, relative to the row Beatport marks as playing.
const id = ids.keyboardPlayback

const playNextOrPrevious = (event: KeyboardEvent) => {
  // typing in a text field, Beatport's search or our playlist filter, must not drive the player
  if ((event.target as Element | null)?.closest('input, textarea, [contenteditable]')) {
    return
  }
  if (!document.body.classList.contains(id)) {
    return
  }
  const currentRow = document.querySelector(`.${rowClass}.${rowActiveClassOriginal}`)
  const { prevElement, nextElement } = findSiblingElementsByClasses(currentRow, [rowClass])
  if (event.key === 'z') {
    nextElement?.querySelector<HTMLButtonElement>(playOrReplayButtonSelector)?.click()
  }
  if (event.key === 'a') {
    prevElement?.querySelector<HTMLButtonElement>(playOrReplayButtonSelector)?.click()
  }
}

export const keyboardPlayback: ContentFeature = {
  id,
  start: () => document.addEventListener('keyup', playNextOrPrevious)
}
