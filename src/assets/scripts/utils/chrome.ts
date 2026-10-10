import { defaultFeatures, Feature } from '../../../store'
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

// Only the enabled flags come from storage, labels and new features always come from code
export const getFeatures = async (): Promise<Feature[]> => {
  try {
    const stored = await getItem<Feature[]>(featuresStorageKey)
    return defaultFeatures.map(feature => ({
      ...feature,
      enabled: stored.find(({ id }) => id === feature.id)?.enabled ?? feature.enabled
    }))
  } catch (e) {
    console.warn(e)
    return defaultFeatures
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
