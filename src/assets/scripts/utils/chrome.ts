import type { FeatureMeta } from '../../../features/types'
import { getLastPlayedReleasesFromLocalStorage } from './storage'

export type LastPlayed = Record<string, Record<string, string>>

export const lastPlayedStorageKey = 'beatport-last-played'
export const featuresStorageKey = 'beatport-ui-features'

export const getItem = <T>(key: string): Promise<T> =>
  new Promise((resolve, reject) => {
    chrome.storage.sync.get(key, result => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError)
      }
      if (!result[key]) {
        return reject(new Error(`No item found for key: ${key}`))
      }
      resolve(result[key] as T)
    })
  })

// Only the enabled flags come from storage, labels and new features always come from the given list
export const getFeatures = async (defaults: FeatureMeta[]): Promise<FeatureMeta[]> => {
  try {
    const stored = await getItem<FeatureMeta[]>(featuresStorageKey)
    return defaults.map(feature => ({
      ...feature,
      enabled: stored.find(({ id }) => id === feature.id)?.enabled ?? feature.enabled
    }))
  } catch (e) {
    console.warn(e)
    return defaults
  }
}

export const getLastPlayedReleases = async (): Promise<LastPlayed> => {
  try {
    return await getItem(lastPlayedStorageKey)
  } catch (e) {
    console.warn(e)
    return getLastPlayedReleasesFromLocalStorage()
  }
}
