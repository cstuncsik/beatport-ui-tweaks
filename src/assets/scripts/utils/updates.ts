// Update notices: "updated" (what's new since the version the user saw last) and "available" (a newer
// version is out, from the store's onUpdateAvailable or, for zip installs, GitHub's latest release).
// The background writes the state, the popup and the toast on beatport.com read it and mark it seen.
// No DOM references here, the background imports it.
export const updateStorageKey = 'beatport-ui-update'

const repoUrl = 'https://github.com/cstuncsik/beatport-ui-tweaks'
export const changelogUrl = `${repoUrl}/blob/main/CHANGELOG.md`
export const latestReleaseApiUrl = 'https://api.github.com/repos/cstuncsik/beatport-ui-tweaks/releases/latest'
export const releaseUrl = (version: string) => `${repoUrl}/releases/tag/v${version}`

export type UpdateState = {
  // the notes up to this version were seen
  seen: string
  available?: { version: string; source: 'store' | 'github'; seen?: boolean }
}

export type Notice = 'updated' | 'available'

export type ChangelogEntry = { version: string; date: string; items: string[] }

// manifest versions are one to four dot-separated integers, compared number by number
export const newer = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }) > 0

export const installedVersion = () => chrome.runtime.getManifest().version

export const getUpdateState = async (): Promise<UpdateState | undefined> =>
  (await chrome.storage.local.get(updateStorageKey))[updateStorageKey] as UpdateState | undefined

export const setUpdateState = (state: UpdateState) => chrome.storage.local.set({ [updateStorageKey]: state })

// What the badge and the toast announce. The popup goes further: it keeps showing a newer version
// after it was seen, until it is installed.
export const notice = (state: UpdateState | undefined, installed = installedVersion()): Notice | undefined => {
  if (state?.available && !state.available.seen && newer(state.available.version, installed)) {
    return 'available'
  }
  if (state && newer(installed, state.seen)) {
    return 'updated'
  }
}

export const markSeen = async () => {
  const state = await getUpdateState()
  if (state) {
    await setUpdateState({
      ...state,
      seen: installedVersion(),
      available: state.available && { ...state.available, seen: true }
    })
  }
}

// CHANGELOG.md, newest first: "## 2.6.3 (2026-10-23)" headings and "- " bullets. Returns the entries
// newer than `after` up to `upTo`.
export const changelogEntries = (text: string, after: string, upTo: string): ChangelogEntry[] =>
  text
    .split(/^## /m)
    .slice(1)
    .map(section => {
      const [heading, ...lines] = section.split('\n')
      const [version, date = ''] = heading.trim().split(' ')
      const items = lines
        .join('\n')
        .split(/^- /m)
        .slice(1)
        .map(item => item.replace(/\s+/g, ' ').trim())
      return { version, date: date.replace(/[()]/g, ''), items }
    })
    .filter(({ version }) => newer(version, after) && !newer(version, upTo))
