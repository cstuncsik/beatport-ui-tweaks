import { ids } from './index'
import type { ContentFeature } from './types'
import { observeWhileEnabled, waitUntil } from '../assets/scripts/utils/dom'

// Playlist filter: a search box in the header of the "add to playlist" picker, rows whose name does
// not contain every typed word get a hidden class. Beatport only has the first 50 playlists loaded,
// the rest come on scroll, so typing also pulls in the remaining pages through the picker's own
// scroll handler, which fires when the list sits exactly at its bottom.
const id = ids.playlistFilter
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

const syncPlaylistFilter = observeWhileEnabled(id, ensureFilterInput, removeFilterInput)

export const playlistFilter: ContentFeature = {
  id,
  toggle: () => syncPlaylistFilter()
}
