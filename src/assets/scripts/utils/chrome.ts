import { defaultFeatures, Feature } from '../../../store'

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
    const features: Feature[] = await getItem('features')
    return Array.isArray(features) && features.length ? features : defaultFeatures
  } catch (e) {
    console.warn(e)
    return defaultFeatures
  }
}
