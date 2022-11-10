import { LastPlayed, lastPlayedStorageKey } from './chrome'

export const getLastPlayedReleasesFromLocalStorage = (): LastPlayed =>
  JSON.parse(localStorage.getItem(lastPlayedStorageKey) || '{}')
