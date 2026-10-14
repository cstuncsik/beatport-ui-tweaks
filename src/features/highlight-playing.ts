import { ids } from './index'
import type { ContentFeature } from './types'
import { rowActiveClass, rowActiveClassOriginal, rowClass } from './selectors'

// Outlines the row Beatport marks as playing. The outline itself is CSS on the active class, gated by
// the body class.
const id = ids.highlightPlaying

// Beatport moves its "current" class on play; follow it once, on the next DOM change
const initializeActiveObserver = () => {
  if (!document.body.classList.contains(id)) {
    return
  }
  const activeObserver = new MutationObserver(() => {
    document.querySelector(`.${rowActiveClass}`)?.classList.remove(rowActiveClass)
    const activeRow = document.querySelector(`.${rowClass}.${rowActiveClassOriginal}`)
    if (activeRow) {
      activeRow.classList.add(rowActiveClass)
      activeObserver.disconnect()
    }
  })
  activeObserver.observe(document.body, { childList: true, subtree: true })
}

export const highlightPlaying: ContentFeature = {
  id,
  start: () => document.body.addEventListener('click', () => initializeActiveObserver(), true),
  toggle: enabled => {
    document.querySelectorAll(`.${rowActiveClass}`).forEach(row => row.classList.remove(rowActiveClass))
    if (enabled) {
      document.querySelector(`.${rowClass}.${rowActiveClassOriginal}`)?.classList.add(rowActiveClass)
      initializeActiveObserver()
    }
  }
}
