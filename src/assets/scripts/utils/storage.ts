export const lastPalayedStorageKey = `beatport-last-played`

export const getLastPlayedReleases = () => JSON.parse(localStorage.getItem(lastPalayedStorageKey) || '')
export const setLastPlayedGenres = (genres: Record<string, string>) =>
  localStorage.setItem(lastPalayedStorageKey, JSON.stringify(genres))
