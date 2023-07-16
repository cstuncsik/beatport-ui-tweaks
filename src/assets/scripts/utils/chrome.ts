import { defaultFeatures, Feature } from '../../../store'
import { getLastPlayedReleasesFromLocalStorage } from './storage'

export type LastPlayed = Record<string, Record<string, string>>

export const lastPlayedStorageKey = 'beatport-last-played'
export const featuresStorageKey = 'beatport-ui-features'

export const getItem = (key: string): Promise<never> =>
  new Promise((resolve, reject) => {
    chrome.storage.sync.get(key, result => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError)
      }
      if (!result[key]) {
        return reject(new Error(`No item found for key: ${key}`))
      }
      resolve(result[key])
    })
  })

export const getFeatures = async (): Promise<Feature[]> => {
  try {
    return await getItem(featuresStorageKey)
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
