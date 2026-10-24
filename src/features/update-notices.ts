import { ids } from './index'
import type { ContentFeature } from './types'
import { getUpdateState, installedVersion, markSeen, notice, updateStorageKey } from '../assets/scripts/utils/updates'

// The toast on beatport.com after an update or while a newer version is out: one line, a button that
// opens the popup (the notes and the update action live there) and a close button. Closing counts as
// seen, so does opening the popup; either clears the badge and the toast in every tab. CSS shows it
// only while the feature is on.
const toastClass = 'bp-ui-tweak-update-toast'
// Parcel turns this into the extension URL of the icon and lists it under web_accessible_resources
const icon = new URL('../assets/images/icon.png?width=36', import.meta.url).href

const showToast = async () => {
  const state = await getUpdateState()
  const current = notice(state)
  document.querySelector(`.${toastClass}`)?.remove()
  if (!current) {
    return
  }
  const toast = document.createElement('div')
  toast.className = toastClass
  toast.setAttribute('role', 'status')
  const image = document.createElement('img')
  image.src = icon
  image.alt = ''
  const text = document.createElement('span')
  text.textContent =
    current === 'available'
      ? `Beatport UI Tweaks ${state?.available?.version} is available`
      : `Beatport UI Tweaks updated to ${installedVersion()}`
  const open = document.createElement('button')
  open.type = 'button'
  open.textContent = current === 'available' ? 'Details' : "What's new"
  // no markSeen here: the popup reads the notes first, then marks them seen itself
  open.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'open-popup' }))
  const close = document.createElement('button')
  close.type = 'button'
  close.className = `${toastClass}__close`
  close.setAttribute('aria-label', 'Close')
  close.textContent = '×'
  close.addEventListener('click', () => {
    toast.remove()
    markSeen()
  })
  toast.append(image, text, open, close)
  document.body.append(toast)
}

export const updateNotices: ContentFeature = {
  id: ids.updateNotices,
  start: () => {
    showToast()
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[updateStorageKey]) {
        showToast()
      }
    })
  }
}
