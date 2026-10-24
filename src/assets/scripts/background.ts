import { getFeatures } from './utils/chrome'
import { features } from '../../features'
import {
  changelogUrl,
  getUpdateState,
  installedVersion,
  latestReleaseApiUrl,
  markSeen,
  newer,
  notice,
  setUpdateState,
  updateStorageKey
} from './utils/updates'

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-beatport-ui-features') {
    getFeatures(features).then(features => {
      sendResponse({ features })
    })
  }
  if (request.action === 'open-popup') {
    // the toast's "What's new": the popup shows the notes and marks them seen. Without a focused window
    // openPopup rejects, then the changelog on GitHub stands in.
    chrome.action
      .openPopup()
      .catch(async () => {
        await chrome.tabs.create({ url: changelogUrl })
        await markSeen()
      })
      .then(() => sendResponse({}))
  }
  return true
})

// Update notices, see utils/updates.ts. The badge follows the stored state, whoever changes it.
const showBadge = async () => {
  const current = notice(await getUpdateState())
  await chrome.action.setBadgeText({ text: current === 'available' ? '↑' : current === 'updated' ? 'NEW' : '' })
  await chrome.action.setBadgeBackgroundColor({ color: '#01ff95' })
  await chrome.action.setBadgeTextColor({ color: '#141414' })
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[updateStorageKey]) {
    showBadge()
  }
})

// Zip installs (Load unpacked) get no updates from the store, they look at GitHub's latest release once
// a day instead. Store installs never do: the store lags GitHub, Chrome tells them via onUpdateAvailable.
const githubAlarm = 'github-release'

const scheduleGithubCheck = async () => {
  const { installType } = await chrome.management.getSelf()
  // alarms can be cleared on a browser restart, so this runs at every start
  if (installType === 'development' && !(await chrome.alarms.get(githubAlarm))) {
    await chrome.alarms.create(githubAlarm, { delayInMinutes: 1, periodInMinutes: 24 * 60 })
  }
}

const checkGithubRelease = async () => {
  try {
    const response = await fetch(latestReleaseApiUrl)
    if (!response.ok) {
      throw new Error(`GitHub answered ${response.status}`)
    }
    const { tag_name } = (await response.json()) as { tag_name: string }
    const version = tag_name.replace(/^v/, '')
    const state = (await getUpdateState()) ?? { seen: installedVersion() }
    if (newer(version, installedVersion()) && state.available?.version !== version) {
      await setUpdateState({ ...state, available: { version, source: 'github' } })
    }
  } catch (error) {
    console.warn('Beatport UI Tweaks: the GitHub release check failed', error)
  }
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === githubAlarm) {
    checkGithubRelease()
  }
})

chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  const installed = installedVersion()
  const state = await getUpdateState()
  if (reason === 'install') {
    await setUpdateState({ seen: installed })
  }
  if (reason === 'update') {
    // the first update with this code has no state yet: the notes start after the version it replaced.
    // An existing `seen` stays, so two updates without a look at the popup show both.
    const available = state?.available && newer(state.available.version, installed) ? state.available : undefined
    await setUpdateState({ seen: state?.seen ?? previousVersion ?? installed, available })
  }
  await showBadge()
  await scheduleGithubCheck()
})

chrome.runtime.onStartup.addListener(async () => {
  await showBadge()
  await scheduleGithubCheck()
})

// Store installs: Chrome found a newer version but waits until the worker goes idle to install it
chrome.runtime.onUpdateAvailable.addListener(async ({ version }) => {
  const state = (await getUpdateState()) ?? { seen: installedVersion() }
  await setUpdateState({ ...state, available: { version, source: 'store' } })
})
